const axios = require('axios');
const http = require('http');
const https = require('https');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../utils/logger');
const prisma = require('../utils/prisma');
const DEFAULT_TYPING_DURATION_MS = 1200;
const FALLBACK_WEBHOOK_TIMEOUT_MS = 30000;
const WEBHOOK_TIMEOUT_MS = resolveWebhookTimeout(
  process.env.WEBHOOK_TIMEOUT_MS,
  FALLBACK_WEBHOOK_TIMEOUT_MS
);
const WEBHOOK_SLOW_RESPONSE_MS = resolveSlowResponseThreshold(
  process.env.WEBHOOK_SLOW_RESPONSE_MS,
  WEBHOOK_TIMEOUT_MS
);
const webhookHttpClient = axios.create({
  timeout: WEBHOOK_TIMEOUT_MS !== null ? WEBHOOK_TIMEOUT_MS : undefined,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 100 }),
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 100,
    rejectUnauthorized: process.env.WEBHOOK_REJECT_UNAUTHORIZED !== 'false'
  }),
  maxBodyLength: Infinity,
  maxContentLength: Infinity
});
const sendQueues = new Map(); // sessionId -> Promise chain for outbound sends

async function getOrInitRuntimeSession(sessionId) {
  const { getSession, initializeSession } = require('./sessionManager');

  let session = getSession(sessionId);
  if (session) {
    return session;
  }

  const sessionRecord = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { status: true }
  });

  if (sessionRecord?.status === 'connected') {
    try {
      await initializeSession(sessionId);
      session = getSession(sessionId);
    } catch (error) {
      logger.warn(`Unable to rehydrate runtime session ${sessionId} that is marked connected:`, error);
    }
  }

  return session || null;
}

function isContactMethodsMissing(error) {
  const message = error?.message || '';
  return (
    message.includes('getIsMyContact is not a function') ||
    message.includes('ContactMethods.getIsMyContact')
  );
}

function resolveContactDisplayName(contact) {
  if (!contact) {
    return null;
  }

  return (
    contact.pushname ||
    contact.shortName ||
    contact.name ||
    contact.number ||
    null
  );
}

function resolveChatDisplayName(chat, contact) {
  if (!chat) {
    return null;
  }

  if (chat.isGroup) {
    return (
      chat.formattedTitle ||
      chat.name ||
      chat.id?._serialized ||
      null
    );
  }

  const waName = resolveContactDisplayName(contact);
  return (
    waName ||
    chat.formattedTitle ||
    chat.name ||
    chat.id?.user ||
    chat.id?._serialized ||
    null
  );
}

/**
 * Process an incoming WhatsApp message
 * @param {number} sessionId - The session ID
 * @param {object} msg - The WhatsApp message object
 * @param {boolean} isMention - Whether the message is a mention in a group
 */
async function processIncomingMessage(sessionId, msg, isMention = false) {
  try {
    // Ignore status/story updates
    if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') {
      logger.debug(`Skipping status message for session ${sessionId}`);
      return;
    }

    // Get session details
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { webhooks: { where: { active: true } } }
    });

    if (!session) {
      logger.error(`Session ${sessionId} not found, cannot process message`);
      return;
    }

    const hasWebhook = Boolean(session.webhookUrl) || session.webhooks.length > 0;
    const isGroupMessage = msg.from.endsWith('@g.us') || msg.to?.endsWith('@g.us');
    const isOutboundMessage = Boolean(msg.fromMe);
    const shouldSendWebhook =
      hasWebhook && !isOutboundMessage && (!isGroupMessage || isMention);

    if (!hasWebhook) {
      logger.debug(
        `Session ${sessionId} has no webhook configured, storing message without webhook dispatch`
      );
    } else if (isOutboundMessage) {
      logger.debug(
        `Outbound message ${msg.id.id} captured for session ${sessionId}; webhook dispatch skipped`
      );
    } else if (isGroupMessage && !isMention) {
      logger.debug(
        `Group message captured for session ${sessionId} without mention; webhook dispatch skipped`
      );
    }

    const existingMessage = await prisma.message.findUnique({
      where: {
        sessionId_messageId: {
          sessionId,
          messageId: msg.id.id
        }
      }
    });

    if (existingMessage) {
      logger.debug(
        `Message ${msg.id.id} already recorded for session ${sessionId}, skipping duplicate save`
      );

      if (shouldSendWebhook && !existingMessage.webhookSent) {
        try {
          await sendToWebhook(session, existingMessage);
          logger.info(`Webhook re-sent for previously saved message ${existingMessage.id}`);
        } catch (error) {
          logger.error(
            `Failed to resend webhook for existing message ${existingMessage.id}:`,
            error
          );
        }
      }

      return existingMessage;
    }

    // Get message details
    let chat = null;
    try {
      chat = await msg.getChat();
    } catch (error) {
      logger.warn(`Unable to load chat info for incoming message ${msg.id.id}:`, error);
    }

    let contact = null;
    try {
      contact = await msg.getContact();
    } catch (error) {
      // Recent WhatsApp Web updates occasionally break contact lookups in wwebjs;
      // continue without contact metadata instead of failing the whole pipeline.
      if (isContactMethodsMissing(error)) {
        logger.debug(
          `Skipping contact lookup for incoming message ${msg.id.id} because ContactMethods API changed; proceeding without contact metadata`
        );
      } else {
        logger.warn(`Unable to load contact info for incoming message ${msg.id.id}:`, error);
      }
    }

    // Prepare message data
    const chatId = chat && chat.isGroup ? chat.id._serialized : null;
    const chatName = resolveChatDisplayName(chat, contact);
    const contactName = resolveContactDisplayName(contact);

    const messageData = {
      sessionId,
      messageId: msg.id.id,
      fromNumber: msg.from,
      toNumber: msg.to || null,
      contactName,
      groupId: chatId,
      chatName,
      author: msg.author || null,
      fromMe: Boolean(msg.fromMe),
      messageType: msg.type,
      content: msg.body,
      timestamp: new Date(msg.timestamp * 1000),
      webhookSent: false
    };

    // Save message to database
    let savedMessage;
    try {
      savedMessage = await prisma.message.create({
        data: messageData
      });
    } catch (createError) {
      if (createError?.code === 'P2002') {
        logger.warn(
          `Duplicate message detected for session ${sessionId}, message ${msg.id.id}; returning existing record`
        );

        savedMessage = await prisma.message.findUnique({
          where: {
            sessionId_messageId: {
              sessionId,
              messageId: msg.id.id
            }
          }
        });

        if (!savedMessage) {
          throw createError;
        }
      } else {
        throw createError;
      }
    }

    if (savedMessage && savedMessage.id) {
      logger.info(`Message ${savedMessage.id} saved for session ${sessionId}`);
    }

    // Process media if present
    let media = null;
    if (msg.hasMedia) {
      try {
        media = await processMessageMedia(msg, sessionId, savedMessage.id);
      } catch (error) {
        logger.error(`Error processing media for message ${savedMessage.id}:`, error);
      }
    }

    // Send to webhook
    if (shouldSendWebhook) {
      await sendToWebhook(session, savedMessage, media);
    }

    return savedMessage;
  } catch (error) {
    logger.error(`Error processing message for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Process message media (images, documents, etc.)
 * @param {object} msg - The WhatsApp message object
 * @param {number} sessionId - The session ID
 * @param {number} messageId - The message ID
 * @returns {Promise<object>} - Information about the processed media
 */
async function processMessageMedia(msg, sessionId, messageId) {
  try {
    // Create media directory if it doesn't exist
    const mediaDir = path.join(__dirname, '../../media', `session-${sessionId}`);
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    // Download media
    const media = await msg.downloadMedia();
    if (!media) {
      logger.warn(`No media found for message ${messageId}`);
      return null;
    }

    // Determine file extension
    let extension = 'dat';
    if (media.mimetype) {
      const mimeTypeParts = media.mimetype.split('/');
      if (mimeTypeParts.length > 1) {
        extension = mimeTypeParts[1].split(';')[0];
      }
    }

    // Generate filename
    const filename = `${messageId}.${extension}`;
    const filePath = path.join(mediaDir, filename);

    // Save media to file and capture base64 data
    const mediaBuffer = Buffer.from(media.data, 'base64');
    let base64Data;

    if (media.mimetype.startsWith('image/')) {
      const processedBuffer = await sharp(mediaBuffer)
        .resize(800) // Resize to max width of 800px
        .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
        .toBuffer();
      fs.writeFileSync(filePath, processedBuffer);
      base64Data = processedBuffer.toString('base64');
    } else {
      fs.writeFileSync(filePath, mediaBuffer);
      base64Data = mediaBuffer.toString('base64');
    }

    logger.info(`Media saved for message ${messageId} at ${filePath}`);

    return {
      url: `/media/session-${sessionId}/${filename}`,
      data: base64Data,
      mimetype: media.mimetype
    };
  } catch (error) {
    logger.error(`Error processing media for message ${messageId}:`, error);
    throw error;
  }
}

function extractReplies(data) {
  let parsed = data;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [{ message: parsed }];
    }
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];

  return items
    .map((item) => {
      const raw = typeof item === 'string'
        ? item
        : item.reply_message || item.output || item.message;

      if (!raw) return null;

      const srcdocMatch =
        typeof raw === 'string' && raw.match(/srcdoc=["']([^"']+)["']/i);
      let content = srcdocMatch ? srcdocMatch[1] : raw;
      if (typeof content === 'string') {
        content = content.replace(/<[^>]*>/g, '').trim();
      }

      if (!content) return null;
      return {
        content,
        to: typeof item === 'object' ? item.reply_to : undefined
      };
    })
    .filter(Boolean);
}

function resolveReplyTarget(message, explicitTarget) {
  if (typeof explicitTarget === 'string') {
    const trimmedTarget = explicitTarget.trim();
    if (trimmedTarget !== '') {
      return trimmedTarget;
    }
  }

  if (message.fromMe) {
    return message.toNumber || null;
  }

  return message.fromNumber;
}

function logAxiosFailure(context, error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const message = error?.message || error;

  logger.error(
    `${context} (status: ${status ?? 'unknown'})`,
    {
      message,
      responseData: data
    }
  );
}

/**
 * Send message to webhook
 * @param {object} session - The session object
 * @param {object} message - The message object
 * @param {object} media - Media information (if any)
 */
async function sendToWebhook(session, message, media = null) {
  try {
    // Prepare webhook payload
    const messagePayload = {
      id: message.messageId,
      from: message.fromNumber,
      to: message.toNumber,
      contactName: message.contactName,
      groupId: message.groupId,
      type: message.messageType,
      content: message.content,
      timestamp: message.timestamp
    };

    if (media) {
      messagePayload.mediaUrl = media.url;
      if (media.mimetype && media.mimetype.startsWith('image/')) {
        messagePayload.mediaData = media.data;
      }
      messagePayload.mediaMimeType = media.mimetype;
    }

    const payload = {
      sessionId: session.id,
      sessionName: session.sessionName,
      message: messagePayload
    };

    // Send to session webhook if configured
    const webhookTargets = buildWebhookTargets(session);
    if (webhookTargets.length === 0) {
      logger.debug(`Session ${session.id} has no active webhook targets; skipping dispatch`);
      return;
    }

    await Promise.allSettled(
      webhookTargets.map((target) =>
        dispatchWebhookTarget(target, payload, message, session.id)
      )
    );
  } catch (error) {
    logger.error(`Error sending webhook for message ${message.id}:`, error);
  }
}

/**
 * Send a message via WhatsApp
 * @param {number} sessionId - The session ID
 * @param {string} to - The recipient phone number or chat ID
 * @param {string} content - The message content (used as caption for media)
 * @param {object} [options] - Additional message options
 * @param {object} [options.media] - Media payload for the message
 * @returns {Promise<object>} - The sent message
 */
async function sendMessage(sessionId, to, content, options = {}) {
  return enqueueSendOperation(sessionId, () =>
    executeSendMessage(sessionId, to, content, options)
  );
}

async function executeSendMessage(sessionId, to, content, options = {}) {
  try {
    const session = await getOrInitRuntimeSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found or not connected`);
    }

    const normalizedRecipient = normalizeRecipientId(to);
    if (!normalizedRecipient) {
      throw new Error(`Invalid recipient format for ${to}`);
    }

    const digitsForLookup = normalizedRecipient.digits;
    let chatId = normalizedRecipient.value;

    if (!normalizedRecipient.isChatId) {
      const resolved = await resolveChatIdFromDigits(session.client, chatId);
      if (!resolved) {
        throw new Error(`Invalid WhatsApp ID for recipient ${to}`);
      }
      chatId = resolved;
    }

    const mediaOptions = options.media;
    const baseContent = typeof content === 'string' ? content : '';

    const sendToChatId = async (targetChatId) => {
      let outboundContent = baseContent;
      let chatInstance = null;

      try {
        chatInstance = await session.client.getChatById(targetChatId);
      } catch (error) {
        if (isLidResolutionError(error)) {
          logger.warn(
            `Unable to load chat ${targetChatId} before sending message because WhatsApp has not provided a LID yet`
          );
        } else {
          logger.warn(`Unable to load chat ${targetChatId} before sending message:`, error);
        }
      }

      if (chatInstance) {
        try {
          await chatInstance.sendStateTyping();
          const typingDelay = typeof options.typingDuration === 'number'
            ? Math.max(0, Math.min(options.typingDuration, 5000))
            : DEFAULT_TYPING_DURATION_MS;
          if (typingDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, typingDelay));
          }
        } catch (error) {
          logger.warn(`Unable to send typing state for chat ${targetChatId}:`, error);
        }
      }

      let msg;

      if (mediaOptions) {
        const {
          type,
          url = null,
          data = null,
          mimetype = null,
          filename = null,
          caption = null
        } = mediaOptions;

        if (!type || type !== 'image') {
          throw new Error(`Unsupported media type: ${type || 'undefined'}`);
        }

        let mediaPayload;

        if (data) {
          if (!mimetype) {
            throw new Error('Media mimetype is required when providing base64 data');
          }

          const inferredFilename = filename || `media.${inferExtensionFromMime(mimetype)}`;
          const normalizedData = stripBase64Prefix(data);
          mediaPayload = new MessageMedia(mimetype, normalizedData, inferredFilename);
        } else if (url) {
          mediaPayload = await MessageMedia.fromUrl(url, { unsafeMime: true });
        } else {
          throw new Error('Media payload must include either a url or base64 data field');
        }

        const mediaCaption = typeof caption === 'string' && caption.trim() !== ''
          ? caption
          : outboundContent;

        msg = await session.client.sendMessage(targetChatId, mediaPayload, {
          caption: mediaCaption ? mediaCaption : undefined
        });

        outboundContent = (msg && typeof msg.body === 'string' && msg.body.trim() !== '')
          ? msg.body
          : (mediaCaption || '');
      } else {
        if (typeof outboundContent !== 'string' || outboundContent.trim() === '') {
          throw new Error('Message content is required for text messages');
        }

        msg = await session.client.sendMessage(targetChatId, outboundContent);
      }

      let chat = chatInstance;
      let contact = null;

      if (!chat) {
        try {
          chat = await msg.getChat();
        } catch (error) {
          logger.warn(`Unable to load chat info for outbound message ${msg.id.id}:`, error);
        }
      }

      try {
        contact = await msg.getContact();
      } catch (error) {
        if (isContactMethodsMissing(error)) {
          logger.debug(
            `Skipping contact lookup for outbound message ${msg.id.id} because ContactMethods API changed; proceeding without contact metadata`
          );
        } else {
          logger.warn(`Unable to load contact info for outbound message ${msg.id.id}:`, error);
        }
      }

      const persistedGroupId = chat && chat.isGroup ? chat.id._serialized : null;
      const chatName = resolveChatDisplayName(chat, contact);
      const contactName = resolveContactDisplayName(contact);

      const messageData = {
        sessionId,
        messageId: msg.id.id,
        fromNumber: msg.from,
        toNumber: msg.to,
        contactName,
        groupId: persistedGroupId,
        chatName,
        author: msg.author || null,
        fromMe: true,
        messageType: msg.type || (mediaOptions ? mediaOptions.type : 'chat'),
        content: outboundContent,
        timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
        webhookSent: false
      };

      const savedMessage = await prisma.message.upsert({
        where: {
          sessionId_messageId: {
            sessionId,
            messageId: msg.id.id
          }
        },
        create: messageData,
        update: {
          content: messageData.content,
          messageType: messageData.messageType,
          timestamp: messageData.timestamp,
          contactName: messageData.contactName
        }
      });

      logger.info(
        `Message ${savedMessage.id} sent from session ${sessionId} to ${targetChatId}`
      );

      return savedMessage;
    };

    try {
      return await sendToChatId(chatId);
    } catch (error) {
      if (isLidResolutionError(error) && digitsForLookup) {
        const resolvedChatId = await resolveChatIdFromDigits(session.client, digitsForLookup);
        if (resolvedChatId && resolvedChatId !== chatId) {
          logger.warn(
            `Retrying message for session ${sessionId} using WhatsApp-resolved chat ID ${resolvedChatId} after LID error`
          );
          return await sendToChatId(resolvedChatId);
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Error sending message from session ${sessionId} to ${to}:`, error);
    throw error;
  }
}

function inferExtensionFromMime(mimetype) {
  if (!mimetype) return 'bin';
  const [type, subtype] = mimetype.split('/');
  if (!subtype) {
    return type || 'bin';
  }
  return subtype.split(';')[0] || 'bin';
}

function stripBase64Prefix(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const base64Marker = ';base64,';
  const markerIndex = value.indexOf(base64Marker);

  if (markerIndex !== -1) {
    return value
      .slice(markerIndex + base64Marker.length)
      .replace(/\s+/g, '');
  }

  if (value.startsWith('data:')) {
    const commaIndex = value.indexOf(',');
    if (commaIndex !== -1) {
      return value
        .slice(commaIndex + 1)
        .replace(/\s+/g, '');
    }
  }

  return value.replace(/\s+/g, '');
}

function normalizeRecipientId(rawTo) {
  if (typeof rawTo !== 'string') {
    return null;
  }

  const trimmed = rawTo.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const digits = extractDigits(trimmed);

  if (lower.endsWith('@g.us') || lower.endsWith('@c.us')) {
    return { value: trimmed, isChatId: true, digits };
  }

  if (lower.endsWith('@s.whatsapp.net')) {
    const normalized = trimmed.replace(/@s\.whatsapp\.net$/i, '@c.us');
    return { value: normalized, isChatId: true, digits: extractDigits(normalized) };
  }

  if (lower.endsWith('@lid')) {
    return {
      value: trimmed,
      isChatId: true,
      digits,
      rawIsLid: true
    };
  }

  return digits ? { value: digits, isChatId: false, digits } : null;
}

function enqueueSendOperation(sessionId, operation) {
  const previous = sendQueues.get(sessionId) || Promise.resolve();

  const nextOperation = previous
    .catch((error) => {
      if (error) {
        logger.warn(
          `Previous send operation for session ${sessionId} failed:`,
          error?.message || error
        );
      }
    })
    .then(operation);

  sendQueues.set(sessionId, nextOperation);

  return nextOperation.finally(() => {
    if (sendQueues.get(sessionId) === nextOperation) {
      sendQueues.delete(sessionId);
    }
  });
}

async function resolveChatIdFromDigits(client, digits) {
  if (!client || !digits) {
    return null;
  }

  try {
    const numberId = await client.getNumberId(digits);
    if (numberId && numberId._serialized) {
      return numberId._serialized;
    }
    return null;
  } catch (error) {
    if (isLidResolutionError(error)) {
      return `${digits}@c.us`;
    }
    throw error;
  }
}

function isLidResolutionError(error) {
  const message = error?.message || '';
  return (
    message.includes('No LID for user') ||
    message.includes('toUserLidOrThrow')
  );
}

function extractDigits(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const digits = value.replace(/[^\d]/g, '');
  return digits || null;
}

function resolveWebhookTimeout(rawValue, fallbackValue) {
  if (typeof rawValue === 'string' && rawValue.trim() !== '') {
    const parsed = parseInt(rawValue, 10);
    if (!Number.isNaN(parsed)) {
      if (parsed <= 0) {
        return null;
      }

      return parsed;
    }
  }

  return fallbackValue;
}

function resolveSlowResponseThreshold(rawValue, timeoutMs) {
  if (typeof rawValue === 'string' && rawValue.trim() !== '') {
    const parsed = parseInt(rawValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    return Math.max(1000, Math.min(timeoutMs - 1000, 10000));
  }

  return 10000;
}

function buildWebhookTargets(session) {
  const targets = [];

  if (session.webhookUrl) {
    targets.push({
      url: session.webhookUrl,
      headers: {},
      label: 'session webhook'
    });
  }

  if (session.webhooks && session.webhooks.length > 0) {
    for (const webhook of session.webhooks) {
      targets.push({
        url: webhook.url,
        headers: webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {},
        label: `webhook ${webhook.id}`
      });
    }
  }

  return targets;
}

function buildWebhookRequestConfig(additionalHeaders = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'WhatsApp-Management-System/1.0',
      ...additionalHeaders
    }
  };

  if (WEBHOOK_TIMEOUT_MS !== null) {
    config.timeout = WEBHOOK_TIMEOUT_MS;
  }

  return config;
}

function startSlowResponseTimer(targetUrl) {
  if (!WEBHOOK_SLOW_RESPONSE_MS || WEBHOOK_SLOW_RESPONSE_MS <= 0) {
    return null;
  }

  const timer = setTimeout(() => {
    logger.warn(
      `Webhook ${targetUrl} is still processing after ${WEBHOOK_SLOW_RESPONSE_MS}ms` +
      (WEBHOOK_TIMEOUT_MS === null ? '' : ` (timeout at ${WEBHOOK_TIMEOUT_MS}ms)`)
    );
  }, WEBHOOK_SLOW_RESPONSE_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return timer;
}

async function markMessageWebhookSent(message) {
  if (!message || message.webhookSent) {
    return;
  }

  try {
    await prisma.message.update({
      where: { id: message.id },
      data: { webhookSent: true }
    });

    message.webhookSent = true;
  } catch (error) {
    logger.warn(`Unable to mark message ${message?.id} as webhook-sent:`, error);
  }
}

async function dispatchWebhookTarget(target, payload, message, sessionId) {
  logger.info(`Sending webhook for message ${message.id} to ${target.url}`);

  const slowTimer = startSlowResponseTimer(target.url);
  const startedAt = Date.now();

  try {
    const response = await webhookHttpClient.post(
      target.url,
      payload,
      buildWebhookRequestConfig(target.headers)
    );

    const durationMs = Date.now() - startedAt;
    logger.info(
      `Webhook sent for message ${message.id} to ${target.url}, status: ${response.status}, duration: ${durationMs}ms`
    );

    await markMessageWebhookSent(message);
    await handleWebhookReplies(response.data, message, sessionId);
  } catch (error) {
    logAxiosFailure(
      `Error sending webhook for message ${message.id} to ${target.url}`,
      error
    );
  } finally {
    if (slowTimer) {
      clearTimeout(slowTimer);
    }
  }
}

async function handleWebhookReplies(responseData, message, sessionId) {
  if (!responseData) {
    return;
  }

  // Ensure the session is alive before trying to auto-reply
  const runtimeSession = await getOrInitRuntimeSession(sessionId);
  if (!runtimeSession) {
    logger.warn(
      `Skipping auto-replies for message ${message.id} because session ${sessionId} is not connected`
    );
    return;
  }

  const replies = extractReplies(responseData);
  for (const reply of replies) {
    const to = resolveReplyTarget(message, reply.to);
    if (!to) {
      logger.debug(
        `Skipping auto-reply for message ${message.id} because the target could not be determined`
      );
      continue;
    }
    try {
      await sendMessage(sessionId, to, reply.content);
      logger.info(`Auto-reply sent for message ${message.id} to ${to}`);
    } catch (replyError) {
      logger.error(`Error sending auto-reply for message ${message.id}:`, replyError);
    }
  }
}

module.exports = {
  processIncomingMessage,
  sendMessage
};
