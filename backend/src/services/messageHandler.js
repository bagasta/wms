const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Process an incoming WhatsApp message
 * @param {number} sessionId - The session ID
 * @param {object} msg - The WhatsApp message object
 * @param {boolean} isMention - Whether the message is a mention in a group
 */
async function processIncomingMessage(sessionId, msg, isMention = false) {
  try {
    // Get session details
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { webhooks: { where: { active: true } } }
    });

    if (!session) {
      logger.error(`Session ${sessionId} not found, cannot process message`);
      return;
    }

    // Skip if no webhook is configured
    if (!session.webhookUrl && session.webhooks.length === 0) {
      logger.debug(`Session ${sessionId} has no webhook configured, skipping message`);
      return;
    }

    // Skip group messages without mention if not explicitly handled
    if (msg.from.endsWith('@g.us') && !isMention) {
      logger.debug(`Skipping group message without mention for session ${sessionId}`);
      return;
    }

    // Get message details
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    
    // Prepare message data
    const messageData = {
      sessionId,
      messageId: msg.id.id,
      fromNumber: msg.from,
      toNumber: msg.to || null,
      contactName: contact.name || contact.pushname || null,
      groupId: chat.isGroup ? chat.id._serialized : null,
      messageType: msg.type,
      content: msg.body,
      timestamp: new Date(msg.timestamp * 1000),
      webhookSent: false
    };

    // Save message to database
    const savedMessage = await prisma.message.create({
      data: messageData
    });

    logger.info(`Message ${savedMessage.id} saved for session ${sessionId}`);

    // Process media if present
    let mediaUrl = null;
    if (msg.hasMedia) {
      try {
        mediaUrl = await processMessageMedia(msg, sessionId, savedMessage.id);
      } catch (error) {
        logger.error(`Error processing media for message ${savedMessage.id}:`, error);
      }
    }

    // Send to webhook
    await sendToWebhook(session, savedMessage, mediaUrl);

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
 * @returns {Promise<string>} - The URL of the processed media
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

    // Save media to file
    const mediaBuffer = Buffer.from(media.data, 'base64');
    
    // Compress image if it's an image
    if (media.mimetype.startsWith('image/')) {
      await sharp(mediaBuffer)
        .resize(800) // Resize to max width of 800px
        .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
        .toFile(filePath);
    } else {
      // Save other media types as is
      fs.writeFileSync(filePath, mediaBuffer);
    }

    logger.info(`Media saved for message ${messageId} at ${filePath}`);
    
    // Return relative path that can be used in API responses
    return `/media/session-${sessionId}/${filename}`;
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
 * @param {string} mediaUrl - The URL of the media (if any)
 */
async function sendToWebhook(session, message, mediaUrl = null) {
  try {
    // Prepare webhook payload
    const payload = {
      sessionId: session.id,
      sessionName: session.sessionName,
      message: {
        id: message.messageId,
        from: message.fromNumber,
        to: message.toNumber,
        contactName: message.contactName,
        groupId: message.groupId,
        type: message.messageType,
        content: message.content,
        timestamp: message.timestamp,
        mediaUrl: mediaUrl
      }
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
 * @param {string} to - The recipient phone number
 * @param {string} content - The message content
 * @returns {Promise<object>} - The sent message
 */
async function sendMessage(sessionId, to, content) {
  try {
    const { getSession } = require('./sessionManager');
    const session = getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found or not connected`);
    }

    // Send message
    const msg = await session.client.sendMessage(to, content);
    
    // Save sent message to database
    const messageData = {
      sessionId,
      messageId: msg.id.id,
      fromNumber: msg.from,
      toNumber: msg.to,
      contactName: null,
      groupId: null,
      messageType: 'chat',
      content: content,
      timestamp: new Date(),
      webhookSent: true
    };

    const savedMessage = await prisma.message.create({
      data: messageData
    });

    logger.info(`Message ${savedMessage.id} sent from session ${sessionId} to ${to}`);
    
    return savedMessage;
  } catch (error) {
    logger.error(`Error sending message from session ${sessionId} to ${to}:`, error);
    throw error;
  }
}

module.exports = {
  processIncomingMessage,
  sendMessage
};

