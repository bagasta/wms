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
      // Generate QR code for terminal (for debugging)
      qrcode.generate(qr, { small: true });

      try {
        // Convert QR string to data URL for dashboard display
        const qrDataUrl = await QRCode.toDataURL(qr);

        // Save QR code to database
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            qrCode: qrDataUrl,
            status: 'connecting'
          }
        });

        logger.info(`QR code generated for session ${sessionId}`);
      } catch (error) {
        logger.error(`Failed to generate QR code for session ${sessionId}:`, error);
      }
    });

    client.on('ready', async () => {
      logger.info(`Session ${sessionId} is ready`);
      
      // Update session status in database
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'connected',
          qrCode: null,
          lastSeen: new Date()
        }
      });
    });

    client.on('authenticated', () => {
      logger.info(`Session ${sessionId} authenticated`);
    });

    client.on('auth_failure', async (msg) => {
      logger.error(`Session ${sessionId} authentication failed: ${msg}`);
      
      // Update session status in database
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'disconnected',
          qrCode: null
        }
      });
      
      // Remove session from map
      sessions.delete(sessionId);
    });

    client.on('disconnected', async (reason) => {
      logger.info(`Session ${sessionId} disconnected: ${reason}`);
      
      // Update session status in database
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'disconnected',
          qrCode: null
        }
      });
      
      // Remove session from map
      sessions.delete(sessionId);
    });

    // Handle incoming messages
    client.on('message', async (msg) => {
      try {
        await processIncomingMessage(sessionId, msg);
      } catch (error) {
        logger.error(`Error processing message for session ${sessionId}:`, error);
      }
    });

    // Handle group messages with mentions
    client.on('message_create', async (msg) => {
      try {
        // Check if it's a group message and if the bot is mentioned
        if (msg.fromMe || !msg.from.endsWith('@g.us')) return;
        
        const chat = await msg.getChat();
        if (!chat.isGroup) return;
        
        // Get the client info to check for mentions
        const info = await client.getWid();
        const mentionedIds = msg.mentionedIds || [];
        
        if (mentionedIds.includes(info._serialized)) {
          await processIncomingMessage(sessionId, msg, true);
        }
      } catch (error) {
        logger.error(`Error processing group message for session ${sessionId}:`, error);
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

module.exports = {
  initializeSessionManager,
  initializeSession,
  getSession,
  getAllSessions,
  closeSession
};

