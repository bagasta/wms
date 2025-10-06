const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { processIncomingMessage } = require('./messageHandler');

const prisma = new PrismaClient();
const sessions = new Map();
const typingStatus = new Map(); // sessionId -> Map(chatId -> { isTyping, updatedAt })

function getSessionTypingMap(sessionId) {
  if (!typingStatus.has(sessionId)) {
    typingStatus.set(sessionId, new Map());
  }
  return typingStatus.get(sessionId);
}

function setTypingStatus(sessionId, chatId, isTyping) {
  const map = getSessionTypingMap(sessionId);
  if (!chatId) {
    return;
  }

  if (isTyping) {
    map.set(chatId, {
      isTyping: true,
      updatedAt: Date.now()
    });
  } else {
    map.set(chatId, {
      isTyping: false,
      updatedAt: Date.now()
    });
  }
}

function isChatTyping(sessionId, chatId) {
  const map = typingStatus.get(sessionId);
  if (!map) {
    return false;
  }

  const record = map.get(chatId);
  if (!record) {
    return false;
  }

  const age = Date.now() - record.updatedAt;

  if (age > 15000 && record.isTyping) {
    // Expire stale typing status after 15 seconds
    map.set(chatId, {
      isTyping: false,
      updatedAt: Date.now()
    });
    return false;
  }

  return Boolean(record.isTyping);
}

async function updateSessionRecord(sessionId, data) {
  try {
    const result = await prisma.session.updateMany({
      where: { id: sessionId },
      data
    });

    if (result.count === 0) {
      logger.error(`Session ${sessionId} not found when updating record`);
      return false;
    }

    const entry = sessions.get(sessionId);
    if (entry) {
      const info = { ...entry.info };

      if (Object.prototype.hasOwnProperty.call(data, 'status')) {
        info.status = data.status;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'lastSeen')) {
        info.lastSeen = data.lastSeen;
      }

      entry.info = info;
      sessions.set(sessionId, entry);
    }

    return true;
  } catch (error) {
    logger.error(`Failed to update session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Initialize the WhatsApp session manager
 * This will load all active sessions from the database and initialize them
 */
async function initializeSessionManager() {
  try {
    // Get all sessions with status 'connected' or 'connecting'
    const activeSessions = await prisma.session.findMany({
      where: {
        OR: [
          { status: 'connected' },
          { status: 'connecting' }
        ]
      }
    });

    logger.info(`Found ${activeSessions.length} active sessions to initialize`);

    // Initialize each session
    for (const session of activeSessions) {
      await initializeSession(session.id);
    }

    return true;
  } catch (error) {
    logger.error('Error initializing session manager:', error);
    throw error;
  }
}

/**
 * Initialize a WhatsApp session
 * @param {number} sessionId - The session ID
 * @returns {Promise<object>} - The session object
 */
async function initializeSession(sessionId) {
  try {
    // Check if session already exists
    if (sessions.has(sessionId)) {
      logger.info(`Session ${sessionId} already initialized`);
      return sessions.get(sessionId);
    }

    // Get session from database
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    logger.info(`Initializing session ${sessionId} (${session.sessionName})`);

    // Create session directory if it doesn't exist
    const sessionDir = path.join(process.env.WWEBJS_DATA_DIR || '.wwebjs_auth', `session-${sessionId}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Create WhatsApp client
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: `session-${sessionId}`,
        dataPath: process.env.WWEBJS_DATA_DIR || '.wwebjs_auth'
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    // Set up event handlers
    client.on('qr', async (qr) => {
      // Generate QR code for terminal (for debugging) and log it via Winston
      qrcode.generate(qr, { small: true }, (asciiQR) => {
        logger.info(`QR code for session ${sessionId}:\n${asciiQR}`);
      });
      logger.debug(`QR string for session ${sessionId}: ${qr}`);

      try {
        // Convert QR string to data URL for dashboard display
        const qrDataUrl = await QRCode.toDataURL(qr);

        const updated = await updateSessionRecord(sessionId, {
          qrCode: qrDataUrl,
          status: 'connecting'
        });

        if (!updated) {
          logger.error(`Session ${sessionId} not found when saving QR code`);
        } else {
          logger.info(`QR code generated for session ${sessionId}`);
        }
      } catch (error) {
        logger.error(`Failed to generate QR code for session ${sessionId}:`, error);
      }
    });

    client.on('ready', async () => {
      logger.info(`Session ${sessionId} is ready`);
      await updateSessionRecord(sessionId, {
        status: 'connected',
        qrCode: null,
        lastSeen: new Date()
      });

      const existing = sessions.get(sessionId);
      if (existing) {
        existing.info.status = 'connected';
        existing.info.lastSeen = new Date();
      }
    });

    client.on('authenticated', async () => {
      logger.info(`Session ${sessionId} authenticated`);

      await updateSessionRecord(sessionId, {
        status: 'connected',
        qrCode: null,
        lastSeen: new Date()
      });

      const existing = sessions.get(sessionId);
      if (existing) {
        existing.info.status = 'connected';
        existing.info.lastSeen = new Date();
      }
    });

    client.on('change_state', async (state) => {
      logger.info(`Session ${sessionId} state changed to ${state}`);

      if (state === 'CONNECTED') {
        await updateSessionRecord(sessionId, {
          status: 'connected',
          qrCode: null,
          lastSeen: new Date()
        });

        const existing = sessions.get(sessionId);
        if (existing) {
          existing.info.status = 'connected';
          existing.info.lastSeen = new Date();
        }
      }
    });

    client.on('auth_failure', async (msg) => {
      logger.error(`Session ${sessionId} authentication failed: ${msg}`);
      
      await updateSessionRecord(sessionId, {
        status: 'disconnected',
        qrCode: null
      });
      
      // Remove session from map
      sessions.delete(sessionId);
      typingStatus.delete(sessionId);
    });

    client.on('disconnected', async (reason) => {
      logger.info(`Session ${sessionId} disconnected: ${reason}`);
      
      await updateSessionRecord(sessionId, {
        status: 'disconnected',
        qrCode: null
      });
      
      // Remove session from map
      sessions.delete(sessionId);
      typingStatus.delete(sessionId);
    });

    // Handle incoming messages and detect mentions in groups
    client.on('message', async (msg) => {
      try {
        if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') {
          logger.debug(`Skipping status message for session ${sessionId}`);
          return;
        }

        let isMention = false;

        if (msg.from.endsWith('@g.us')) {
          const mentions = await msg.getMentions();
          isMention = mentions.some((contact) => contact.isMe);
        }

        await processIncomingMessage(sessionId, msg, isMention);
      } catch (error) {
        logger.error(`Error processing message for session ${sessionId}:`, error);
      }
    });

    client.on('message_create', async (msg) => {
      try {
        if (!msg.fromMe) {
          return;
        }

        await processIncomingMessage(sessionId, msg, false);
      } catch (error) {
        logger.error(`Error processing outbound message for session ${sessionId}:`, error);
      }
    });

    client.on('typing', (chat) => {
      try {
        setTypingStatus(sessionId, chat?.id?._serialized, true);
      } catch (error) {
        logger.warn(`Failed to record typing state for session ${sessionId}:`, error);
      }
    });

    client.on('stop_typing', (chat) => {
      try {
        setTypingStatus(sessionId, chat?.id?._serialized, false);
      } catch (error) {
        logger.warn(`Failed to clear typing state for session ${sessionId}:`, error);
      }
    });

    // Initialize the client
    await client.initialize();

    // Store session in map
    sessions.set(sessionId, {
      client,
      info: {
        id: sessionId,
        name: session.sessionName,
        status: session.status
      }
    });

    return sessions.get(sessionId);
  } catch (error) {
    logger.error(`Error initializing session ${sessionId}:`, error);
    
    await updateSessionRecord(sessionId, {
      status: 'disconnected',
      qrCode: null
    });
    
    throw error;
  }
}

/**
 * Get a WhatsApp session
 * @param {number} sessionId - The session ID
 * @returns {object|null} - The session object or null if not found
 */
function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Get all WhatsApp sessions
 * @returns {Map} - Map of all sessions
 */
function getAllSessions() {
  return sessions;
}

/**
 * Close a WhatsApp session
 * @param {number} sessionId - The session ID
 * @returns {Promise<boolean>} - True if session was closed, false otherwise
 */
async function closeSession(sessionId) {
  try {
    const session = sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found, cannot close`);
      return false;
    }

    // Logout and close the client
    await session.client.destroy();
    
    // Remove session from map
    sessions.delete(sessionId);
    typingStatus.delete(sessionId);
    
    // Update session status in database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'disconnected',
        qrCode: null
      }
    });
    
    logger.info(`Session ${sessionId} closed successfully`);
    return true;
  } catch (error) {
    logger.error(`Error closing session ${sessionId}:`, error);
    
    // Force remove session from map
    sessions.delete(sessionId);
    typingStatus.delete(sessionId);
    
    // Update session status in database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'disconnected',
        qrCode: null
      }
    });
    
    throw error;
  }
}

function normalizeChatName(chat) {
  if (!chat) {
    return 'Unknown chat';
  }

  if (chat.name) {
    return chat.name;
  }

  if (chat.formattedTitle) {
    return chat.formattedTitle;
  }

  if (chat.isGroup && chat.id && chat.id.user) {
    return chat.id.user;
  }

  if (chat.contact && chat.contact.pushname) {
    return chat.contact.pushname;
  }

  if (chat.id && chat.id.user) {
    return chat.id.user;
  }

  return chat.id?._serialized || 'Unknown chat';
}

function extractLastMessageSummary(chat) {
  const lastMessage = chat?.lastMessage;

  if (!lastMessage) {
    return {
      preview: null,
      timestamp: null,
      fromMe: null
    };
  }

  return {
    preview: typeof lastMessage.body === 'string' ? lastMessage.body : null,
    timestamp:
      typeof lastMessage.timestamp === 'number'
        ? new Date(lastMessage.timestamp * 1000)
        : null,
    fromMe: Boolean(lastMessage.fromMe)
  };
}

/**
 * Get the available chats for a session (groups and direct chats)
 * @param {number} sessionId - The session ID
 * @returns {Promise<object[]>}
 */
async function getSessionChats(sessionId) {
  const runtimeSession = sessions.get(sessionId);

  if (!runtimeSession) {
    throw new Error(`Session ${sessionId} is not connected`);
  }

  const chats = await runtimeSession.client.getChats();

  return chats
    .map((chat) => {
      const lastMessageSummary = extractLastMessageSummary(chat);
      const chatId = chat.id?._serialized;

      return {
        id: chatId,
        name: normalizeChatName(chat),
        isGroup: Boolean(chat.isGroup),
        unreadCount: Number.isFinite(chat.unreadCount) ? chat.unreadCount : 0,
        isMuted: Boolean(chat.isMuted),
        isArchived: Boolean(chat.archive),
        isTyping: isChatTyping(sessionId, chatId),
        lastMessagePreview: lastMessageSummary.preview,
        lastMessageTimestamp: lastMessageSummary.timestamp,
        lastMessageFromMe: lastMessageSummary.fromMe
      };
    })
    .sort((a, b) => {
      const aTime = a.lastMessageTimestamp ? a.lastMessageTimestamp.getTime() : 0;
      const bTime = b.lastMessageTimestamp ? b.lastMessageTimestamp.getTime() : 0;
      return bTime - aTime;
    });
}

/**
 * Get all WhatsApp groups for a session
 * @param {number} sessionId - The session ID
 * @returns {Promise<object[]>}
 */
async function getSessionGroups(sessionId) {
  const runtimeSession = sessions.get(sessionId);

  if (!runtimeSession) {
    throw new Error(`Session ${sessionId} is not connected`);
  }

  const chats = await runtimeSession.client.getChats();

  return chats
    .filter((chat) => chat.isGroup)
    .map((chat) => ({
      id: chat.id._serialized,
      name: normalizeChatName(chat),
      participants: Array.isArray(chat.participants) ? chat.participants.length : 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get members for a specific WhatsApp group
 * @param {number} sessionId - The session ID
 * @param {string} groupId - The group chat ID
 * @returns {Promise<object[]>}
 */
async function getGroupParticipants(sessionId, groupId) {
  const runtimeSession = sessions.get(sessionId);

  if (!runtimeSession) {
    throw new Error(`Session ${sessionId} is not connected`);
  }

  const normalizedGroupId = groupId.endsWith('@g.us') ? groupId : `${groupId}@g.us`;
  const chat = await runtimeSession.client.getChatById(normalizedGroupId);

  if (!chat || !chat.isGroup) {
    throw new Error(`Group ${groupId} not found for session ${sessionId}`);
  }

  if (!Array.isArray(chat.participants) || chat.participants.length === 0) {
    logger.warn(`Group ${normalizedGroupId} has no participant metadata loaded`);
  }

  const participants = await Promise.all(
    (chat.participants || []).map(async (participant) => {
      try {
        const contact = await runtimeSession.client.getContactById(participant.id._serialized);
        return {
          id: participant.id._serialized,
          number: contact?.number || participant.id.user,
          name: contact?.name || contact?.pushname || contact?.shortName || participant.id.user,
          isAdmin: Boolean(participant.isAdmin),
          isSuperAdmin: Boolean(participant.isSuperAdmin)
        };
      } catch (error) {
        logger.warn(
          `Unable to load contact info for participant ${participant.id._serialized} in group ${normalizedGroupId}:`,
          error
        );

        return {
          id: participant.id._serialized,
          number: participant.id.user,
          name: participant.id.user,
          isAdmin: Boolean(participant.isAdmin),
          isSuperAdmin: Boolean(participant.isSuperAdmin)
        };
      }
    })
  );

  return participants.sort((a, b) => a.number.localeCompare(b.number));
}

module.exports = {
  initializeSessionManager,
  initializeSession,
  getSession,
  getAllSessions,
  closeSession,
  getSessionChats,
  getSessionGroups,
  getGroupParticipants
};
