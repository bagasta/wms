const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../utils/logger');

const prisma = new PrismaClient();
const DEFAULT_TYPING_DURATION_MS = 1200;

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
    const shouldSendWebhook = hasWebhook && (!isGroupMessage || isMention);

    if (!hasWebhook) {
      logger.debug(
        `Session ${sessionId} has no webhook configured, storing message without webhook dispatch`
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

      return existingMessage;
    }

    // Get message details
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    
    // Prepare message data
    const chatId = chat.isGroup ? chat.id._serialized : null;
    const chatName = chat.name || chat.formattedTitle || contact.name || contact.pushname || null;
    const contactName = contact.name || contact.pushname || contact.number || null;

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
    if (session.webhookUrl) {
      try {
        const response = await axios.post(session.webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'WhatsApp-Management-System/1.0'
          }
        });

        logger.info(`Webhook sent for message ${message.id} to ${session.webhookUrl}, status: ${response.status}`);

        // Update message as webhook sent
        await prisma.message.update({
          where: { id: message.id },
          data: { webhookSent: true }
        });

        // If webhook returns replies, send them back to the original sender
        if (response.data) {
          const replies = extractReplies(response.data);
          for (const reply of replies) {
            const to = reply.to || message.fromNumber;
            try {
              await sendMessage(session.id, to, reply.content);
              logger.info(
                `Auto-reply sent for message ${message.id} to ${to}`
              );
            } catch (replyError) {
              logger.error(
                `Error sending auto-reply for message ${message.id}:`,
                replyError
              );
            }
          }
        }
      } catch (error) {
        logger.error(`Error sending webhook for message ${message.id} to ${session.webhookUrl}:`, error);
      }
    }

    // Send to additional webhooks if configured
    if (session.webhooks && session.webhooks.length > 0) {
      for (const webhook of session.webhooks) {
        try {
          const response = await axios.post(webhook.url, payload, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'WhatsApp-Management-System/1.0',
              ...(webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {})
            }
          });

          logger.info(
            `Webhook sent for message ${message.id} to ${webhook.url}, status: ${response.status}`
          );

          if (response.data) {
            const replies = extractReplies(response.data);
            for (const reply of replies) {
              const to = reply.to || message.fromNumber;
              try {
                await sendMessage(session.id, to, reply.content);
                logger.info(
                  `Auto-reply sent for message ${message.id} to ${to}`
                );
              } catch (replyError) {
                logger.error(
                  `Error sending auto-reply for message ${message.id}:`,
                  replyError
                );
              }
            }
          }
        } catch (error) {
          logger.error(`Error sending webhook for message ${message.id} to ${webhook.url}:`, error);
        }
      }
    }
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
  try {
    const { getSession } = require('./sessionManager');
    const session = getSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found or not connected`);
    }

    // Determine chat ID and validate recipient when needed
    let chatId = to;
    if (!chatId.endsWith('@c.us') && !chatId.endsWith('@g.us')) {
      const numberId = await session.client.getNumberId(to);
      if (!numberId) {
        throw new Error(`Invalid WhatsApp ID for recipient ${to}`);
      }
      chatId = numberId._serialized;
    }

    const mediaOptions = options.media;
    let outboundContent = typeof content === 'string' ? content : '';
    let msg;

    let chatInstance = null;
    try {
      chatInstance = await session.client.getChatById(chatId);
    } catch (error) {
      logger.warn(`Unable to load chat ${chatId} before sending message:`, error);
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
        logger.warn(`Unable to send typing state for chat ${chatId}:`, error);
      }
    }

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

      msg = await session.client.sendMessage(chatId, mediaPayload, {
        caption: mediaCaption ? mediaCaption : undefined
      });

      outboundContent = (msg && typeof msg.body === 'string' && msg.body.trim() !== '')
        ? msg.body
        : (mediaCaption || '');
    } else {
      if (typeof outboundContent !== 'string' || outboundContent.trim() === '') {
        throw new Error('Message content is required for text messages');
      }

      msg = await session.client.sendMessage(chatId, outboundContent);
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
      logger.warn(`Unable to load contact info for outbound message ${msg.id.id}:`, error);
    }

    const persistedGroupId = chat && chat.isGroup ? chat.id._serialized : null;
    const chatName = chat
      ? chat.name || chat.formattedTitle || null
      : null;
    const contactName = !chat || chat.isGroup
      ? contact?.name || contact?.pushname || null
      : contact?.name || contact?.pushname || contact?.number || null;

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

    const savedMessage = await prisma.message.create({
      data: messageData
    });

    logger.info(
      `Message ${savedMessage.id} sent from session ${sessionId} to ${chatId}`
    );

    return savedMessage;
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

module.exports = {
  processIncomingMessage,
  sendMessage
};
