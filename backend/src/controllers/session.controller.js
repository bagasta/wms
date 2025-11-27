const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const {
  initializeSession,
  getSession,
  closeSession,
  getSessionChats,
  getSessionGroups,
  getGroupParticipants,
  restartSession,
  removeSessionAuthData
} = require('../services/sessionManager');

const prisma = new PrismaClient();
const STALE_QR_THRESHOLD_MS = 2 * 60 * 1000;
const FALLBACK_CHAT_HISTORY_LIMIT = 500;

function sanitizeIdentifier(identifier) {
  if (!identifier) {
    return null;
  }

  return String(identifier).split('@')[0];
}

function resolveConversationNameFromMessage(message) {
  if (!message) {
    return 'Unknown chat';
  }

  if (message.chatName) {
    return message.chatName;
  }

  if (message.contactName) {
    return message.contactName;
  }

  const identifier = message.groupId || (message.fromMe ? message.toNumber : message.fromNumber);
  return sanitizeIdentifier(identifier) || 'Unknown chat';
}

async function buildFallbackChatsFromMessages(sessionId) {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'desc' },
    take: FALLBACK_CHAT_HISTORY_LIMIT
  });

  const chatMap = new Map();

  messages.forEach((message) => {
    const conversationId =
      message.groupId || (message.fromMe ? message.toNumber : message.fromNumber);
    if (!conversationId) {
      return;
    }

    if (!chatMap.has(conversationId)) {
      chatMap.set(conversationId, {
        id: conversationId,
        name: resolveConversationNameFromMessage(message),
        isGroup: Boolean(message.groupId),
        unreadCount: 0,
        isMuted: false,
        isArchived: false,
        isTyping: false,
        lastMessagePreview: null,
        lastMessageTimestamp: null,
        lastMessageFromMe: null
      });
    }

    const chat = chatMap.get(conversationId);
    const messageTimestamp = message.timestamp ? new Date(message.timestamp) : null;

    if (messageTimestamp) {
      const currentTime = chat.lastMessageTimestamp
        ? chat.lastMessageTimestamp.getTime()
        : 0;
      if (messageTimestamp.getTime() > currentTime) {
        chat.lastMessageTimestamp = messageTimestamp;
        chat.lastMessagePreview = message.content || message.messageType || null;
        chat.lastMessageFromMe = Boolean(message.fromMe);
      }
    }
  });

  return Array.from(chatMap.values()).sort((a, b) => {
    const aTime = a.lastMessageTimestamp ? a.lastMessageTimestamp.getTime() : 0;
    const bTime = b.lastMessageTimestamp ? b.lastMessageTimestamp.getTime() : 0;
    return bTime - aTime;
  });
}

/**
 * Get all sessions
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function getAllSessions(req, res, next) {
  try {
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        sessionName: true,
        webhookUrl: true,
        status: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
        userId: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: sessions
    });
  } catch (error) {
    logger.error('Error getting all sessions:', error);
    next(error);
  }
}

/**
 * Get a session by ID
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function getSessionById(req, res, next) {
  try {
    const { id } = req.params;
    
    const session = await prisma.session.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        sessionName: true,
        webhookUrl: true,
        status: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
        userId: true
      }
    });

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${id} not found`
      });
    }

    res.status(200).json({
      status: 'success',
      data: session
    });
  } catch (error) {
    logger.error(`Error getting session ${req.params.id}:`, error);
    next(error);
  }
}

/**
 * Create a new session
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function createSession(req, res, next) {
  try {
    const { session_id, session_name, webhook_url, user_id } = req.body;

    // Validate required fields
    if (!session_name || !user_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Session name and user ID are required'
      });
    }

    // Check if session already exists
    const existingSession = await prisma.session.findFirst({
      where: {
        userId: parseInt(user_id),
        sessionName: session_name
      }
    });

    if (existingSession) {
      return res.status(400).json({
        status: 'error',
        message: `Session with name ${session_name} already exists for this user`
      });
    }

    // Create session in database
    const session = await prisma.session.create({
      data: {
        id: session_id ? parseInt(session_id) : undefined,
        sessionName: session_name,
        webhookUrl: webhook_url,
        status: 'disconnected',
        userId: parseInt(user_id)
      }
    });

    logger.info(`Session ${session.id} created`);

    res.status(201).json({
      status: 'success',
      data: session
    });
  } catch (error) {
    logger.error('Error creating session:', error);
    next(error);
  }
}

/**
 * Update a session
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function updateSession(req, res, next) {
  try {
    const { id } = req.params;
    const { session_name, webhook_url } = req.body;

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSession) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${id} not found`
      });
    }

    // Update session in database
    const session = await prisma.session.update({
      where: { id: parseInt(id) },
      data: {
        sessionName: session_name || existingSession.sessionName,
        webhookUrl: webhook_url !== undefined ? webhook_url : existingSession.webhookUrl
      }
    });

    logger.info(`Session ${session.id} updated`);

    res.status(200).json({
      status: 'success',
      data: session
    });
  } catch (error) {
    logger.error(`Error updating session ${req.params.id}:`, error);
    next(error);
  }
}

/**
 * Delete a session
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function deleteSession(req, res, next) {
  try {
    const { id } = req.params;
    const sessionId = parseInt(id, 10);

    if (Number.isNaN(sessionId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid session ID'
      });
    }

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${id} not found`
      });
    }

    // Close session if it's active
    if (existingSession.status === 'connected' || existingSession.status === 'connecting') {
      await closeSession(parseInt(id));
    }

    // Delete session from database
    await prisma.session.delete({
      where: { id: parseInt(id) }
    });

    try {
      await removeSessionAuthData(sessionId);
    } catch (cleanupError) {
      logger.warn(
        `Failed to remove auth directory for session ${id}:`,
        cleanupError
      );
    }

    logger.info(`Session ${id} deleted`);

    res.status(200).json({
      status: 'success',
      message: `Session ${id} deleted successfully`
    });
  } catch (error) {
    logger.error(`Error deleting session ${req.params.id}:`, error);
    next(error);
  }
}

/**
 * Start a session
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function startSession(req, res, next) {
  try {
    const { id } = req.params;

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSession) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${id} not found`
      });
    }

    if (existingSession.status === 'connected') {
      return res.status(200).json({
        status: 'success',
        message: `Session ${id} is already connected`
      });
    }

    // Mark session as connecting and clear any stale QR data
    await prisma.session.update({
      where: { id: parseInt(id) },
      data: {
        status: 'connecting',
        qrCode: null
      }
    });

    logger.info(`Session ${id} started`);

    // Kick off session initialization immediately so QR is generated without waiting for /qr polling
    try {
      await initializeSession(parseInt(id));
    } catch (initError) {
      logger.error(`Failed to initialize session ${id} after start:`, initError);
    }

    // Fetch latest state (may still be null while QR is being generated)
    const sessionState = await prisma.session.findUnique({
      where: { id: parseInt(id) },
      select: { status: true, qrCode: true }
    });

    res.status(200).json({
      status: 'success',
      message: `Session ${id} started successfully`,
      data: {
        status: sessionState?.status || 'connecting',
        qr_code: sessionState?.qrCode || null
      }
    });
  } catch (error) {
    logger.error(`Error starting session ${req.params.id}:`, error);
    next(error);
  }
}

/**
 * Stop a session
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function stopSession(req, res, next) {
  try {
    const { id } = req.params;

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSession) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${id} not found`
      });
    }

    // Close session
    const closed = await closeSession(parseInt(id));

    const message = closed
      ? `Session ${id} stopped successfully`
      : `Session ${id} was not active; marked as disconnected`;

    logger.info(message);

    res.status(200).json({
      status: 'success',
      message
    });
  } catch (error) {
    logger.error(`Error stopping session ${req.params.id}:`, error);
    next(error);
  }
}

/**
 * Get session QR code
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function getSessionQR(req, res, next) {
  try {
    const { id } = req.params;
    const sessionId = parseInt(id, 10);

    if (Number.isNaN(sessionId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid session ID'
      });
    }

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${id} not found`
      });
    }

    // Get session
    let session = getSession(sessionId);

    // If session is not initialized, initialize it
    if (!session) {
      try {
        await initializeSession(sessionId);
        session = getSession(sessionId);
      } catch (initError) {
        logger.error(`Failed to initialize session ${sessionId} while fetching QR:`, initError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to initialize WhatsApp session for QR. Please retry.'
        });
      }
    }

    // Prefer in-memory QR if available, fallback to DB
    const runtimeQr = session?.info?.qrCode || null;

    const sessionState = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        qrCode: true,
        status: true,
        updatedAt: true
      }
    });

    let qrCode = runtimeQr || sessionState?.qrCode || null;
    let statusValue = sessionState?.status || existingSession.status;

    const lastUpdateDate = sessionState?.updatedAt || existingSession.updatedAt;
    const lastUpdate = lastUpdateDate ? new Date(lastUpdateDate).getTime() : null;
    const qrAge = lastUpdate ? Date.now() - lastUpdate : null;
    const qrIsStale =
      Boolean(qrCode) &&
      statusValue === 'connecting' &&
      typeof qrAge === 'number' &&
      qrAge > STALE_QR_THRESHOLD_MS;

    if (qrIsStale) {
      logger.info(
        `QR code for session ${sessionId} is ${qrAge}ms old and stale. Restarting session to generate a fresh code.`
      );

      await restartSession(sessionId);

      const refreshedState = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
          qrCode: true,
          status: true
        }
      });

      qrCode = refreshedState?.qrCode || null;
      statusValue = refreshedState?.status || 'connecting';
    }

    if (!qrCode) {
      logger.debug(`QR request for session ${sessionId} returned empty QR (status=${statusValue})`);
    }

    res.status(200).json({
      status: 'success',
      data: {
        qr_code: qrCode,
        status: statusValue
      }
    });
  } catch (error) {
    logger.error(`Error getting QR code for session ${req.params.id}:`, error);
    next(error);
  }
}

/**
 * Get list of WhatsApp groups for a session
 */
async function getSessionGroupsHandler(req, res, next) {
  const sessionId = parseInt(req.params.id, 10);

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid session ID'
    });
  }

  try {
    const sessionRecord = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!sessionRecord) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${sessionId} not found`
      });
    }

    if (sessionRecord.status !== 'connected') {
      return res.status(400).json({
        status: 'error',
        message: 'Session is not connected. Please start the WhatsApp session before fetching groups.'
      });
    }

    if (!getSession(sessionId)) {
      try {
        await initializeSession(sessionId);
      } catch (error) {
        logger.error(`Unable to initialize session ${sessionId} for group listing:`, error);
        return res.status(500).json({
          status: 'error',
          message: 'Unable to connect to WhatsApp session. Please try again shortly.'
        });
      }
    }

    const groups = await getSessionGroups(sessionId);

    return res.status(200).json({
      status: 'success',
      data: groups
    });
  } catch (error) {
    logger.error(`Error fetching groups for session ${sessionId}:`, error);
    next(error);
  }
}

/**
 * Get chats (groups and direct) for a session
 */
async function getSessionChatsHandler(req, res, next) {
  const sessionId = parseInt(req.params.id, 10);

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid session ID'
    });
  }

  try {
    const sessionRecord = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!sessionRecord) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${sessionId} not found`
      });
    }

    let chats = [];
    let shouldFallbackToHistory = sessionRecord.status !== 'connected';

    if (!shouldFallbackToHistory) {
      if (!getSession(sessionId)) {
        try {
          await initializeSession(sessionId);
        } catch (error) {
          logger.error(`Unable to initialize session ${sessionId} for chat listing:`, error);
          shouldFallbackToHistory = true;
        }
      }

      if (!shouldFallbackToHistory) {
        try {
          chats = await getSessionChats(sessionId);
        } catch (error) {
          logger.error(`Unable to fetch live chats for session ${sessionId}, falling back to stored history:`, error);
          shouldFallbackToHistory = true;
        }
      }
    }

    if (shouldFallbackToHistory) {
      chats = await buildFallbackChatsFromMessages(sessionId);
    }

    return res.status(200).json({
      status: 'success',
      data: chats.map((chat) => ({
        ...chat,
        lastMessageTimestamp: chat.lastMessageTimestamp
          ? chat.lastMessageTimestamp.toISOString()
          : null
      }))
    });
  } catch (error) {
    logger.error(`Error fetching chats for session ${sessionId}:`, error);
    next(error);
  }
}

/**
 * Get members for a specific WhatsApp group
 */
async function getGroupMembersHandler(req, res, next) {
  const sessionId = parseInt(req.params.id, 10);
  const rawGroupId = decodeURIComponent(req.params.groupId || '');

  if (Number.isNaN(sessionId) || !rawGroupId) {
    return res.status(400).json({
      status: 'error',
      message: 'Session ID and group ID are required'
    });
  }

  try {
    const sessionRecord = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!sessionRecord) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${sessionId} not found`
      });
    }

    if (sessionRecord.status !== 'connected') {
      return res.status(400).json({
        status: 'error',
        message: 'Session is not connected. Please start the WhatsApp session before fetching members.'
      });
    }

    if (!getSession(sessionId)) {
      try {
        await initializeSession(sessionId);
      } catch (error) {
        logger.error(`Unable to initialize session ${sessionId} for group extraction:`, error);
        return res.status(500).json({
          status: 'error',
          message: 'Unable to connect to WhatsApp session. Please try again shortly.'
        });
      }
    }

    const members = await getGroupParticipants(sessionId, rawGroupId);

    return res.status(200).json({
      status: 'success',
      data: members
    });
  } catch (error) {
    logger.error(
      `Error fetching members for group ${rawGroupId} on session ${sessionId}:`,
      error
    );
    next(error);
  }
}

module.exports = {
  getAllSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  startSession,
  stopSession,
  getSessionQR,
  getSessionChats: getSessionChatsHandler,
  getSessionGroups: getSessionGroupsHandler,
  getGroupMembers: getGroupMembersHandler
};
