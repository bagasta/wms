const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { processIncomingMessage } = require('./messageHandler');
const sessions = new Map();
const typingStatus = new Map(); // sessionId -> Map(chatId -> { isTyping, updatedAt })
const restartTimers = new Map(); // sessionId -> timeout
const initializingSessions = new Map(); // sessionId -> in-flight init promise
const restartCounts = new Map(); // sessionId -> count
const MAX_RESTARTS = 5;
const RESTART_DELAY_BASE = 5000;

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

async function safeDestroyClient(sessionId, clientInstance) {
  if (!clientInstance) return;
  try {
    await clientInstance.destroy();
  } catch (error) {
    logger.warn(`Failed to destroy client for session ${sessionId}:`, error);
  } finally {
    sessions.delete(sessionId);
    typingStatus.delete(sessionId);
  }
}

function scheduleSessionRestart(sessionId, reason, delayMs = 5000) {
  const currentCount = restartCounts.get(sessionId) || 0;

  if (currentCount >= MAX_RESTARTS) {
    logger.warn(
      `Session ${sessionId} reached max restarts (${MAX_RESTARTS}); requires manual start/scan. Last reason: ${reason}`
    );
    // Reset count so manual start works fresh, or keep it to prevent immediate loop? 
    // Better to leave it, manual start should reset it.
    return;
  }

  const nextCount = currentCount + 1;
  restartCounts.set(sessionId, nextCount);

  // Calculate backoff delay: 5s, 10s, 20s, 40s, 80s...
  const backoffDelay = delayMs * Math.pow(2, currentCount);

  logger.info(
    `Scheduling restart for session ${sessionId} (attempt ${nextCount}/${MAX_RESTARTS}) in ${backoffDelay}ms. Reason: ${reason}`
  );

  const timer = setTimeout(() => {
    restartTimers.delete(sessionId);
    logger.info(`Executing scheduled restart for session ${sessionId}`);
    initializeSession(sessionId).catch((err) => {
      logger.error(`Scheduled restart failed for session ${sessionId}:`, err);
      // If it failed immediately, it might trigger another restart via error handlers
    });
  }, backoffDelay);

  restartTimers.set(sessionId, timer);
}

function clearSessionRestart(sessionId) {
  const timer = restartTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    restartTimers.delete(sessionId);
  }
}

async function updateSessionRecord(sessionId, data) {
  try {
    const result = await prisma.session.updateMany({
      where: { id: sessionId },
      data
    });

    if (result.count === 0) {
      logger.warn(`Session ${sessionId} not found when updating record; cleaning up runtime session if present`);
      sessions.delete(sessionId);
      typingStatus.delete(sessionId);
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

      if (Object.prototype.hasOwnProperty.call(data, 'qrCode')) {
        info.qrCode = data.qrCode;
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
    // Get all sessions that should be actively connected
    const activeSessions = await prisma.session.findMany({
      where: {
        status: { in: ['connected', 'connecting'] }
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
  if (sessions.has(sessionId)) {
    logger.info(`Session ${sessionId} already initialized`);
    return sessions.get(sessionId);
  }

  if (initializingSessions.has(sessionId)) {
    logger.info(`Session ${sessionId} is currently initializing; reusing in-flight promise`);
    return initializingSessions.get(sessionId);
  }

  const initPromise = (async () => {
    try {
      // Get session from database
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      logger.info(`Initializing session ${sessionId} (${session.sessionName})`);

      if (session.status !== 'connected') {
        await updateSessionRecord(sessionId, {
          status: 'connecting',
          qrCode: null
        });
      }

      // Create session directory if it doesn't exist
      const baseAuthDir = process.env.WWEBJS_DATA_DIR || '.wwebjs_auth';
      const sessionDir = path.join(baseAuthDir, `session-${sessionId}`);
      const legacySessionDir = path.join(baseAuthDir, `session-session-${sessionId}`);

      if (fs.existsSync(legacySessionDir)) {
        try {
          fs.rmSync(legacySessionDir, { recursive: true, force: true });
          logger.info(`Removed legacy auth directory ${legacySessionDir} for session ${sessionId}`);
        } catch (legacyError) {
          logger.warn(`Unable to remove legacy auth directory ${legacySessionDir} for session ${sessionId}:`, legacyError);
        }
      }

      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // Create WhatsApp client
      const client = new Client({
        authStrategy: new LocalAuth({
          // Use plain session ID so LocalAuth creates <base>/session-<id>
          clientId: String(sessionId),
          dataPath: baseAuthDir
        }),
        puppeteer: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        // Disable web version caching to avoid LocalWebCache.persist errors when sessions are stopped mid-initialization
        webVersionCache: {
          type: 'none'
        },
        // Explicitly disable legacy LocalWebCache to prevent null persist errors
        webCache: {
          type: 'none'
        }
      });

      // Track whether this client instance has been aborted (e.g., invalid QR / forced logout)
      let aborted = false;
      const isAborted = () => aborted;

      async function abortAndRestart(reason, { clearAuth = false } = {}) {
        if (aborted) return;
        aborted = true;
        clearSessionRestart(sessionId);

        await updateSessionRecord(sessionId, {
          status: 'disconnected',
          qrCode: null
        });

        try {
          await safeDestroyClient(sessionId, client);
        } catch (destroyError) {
          logger.warn(`Failed to destroy client during abort for session ${sessionId}:`, destroyError);
        }

        if (clearAuth) {
          try {
            await removeSessionAuthData(sessionId);
          } catch (cleanupError) {
            logger.warn(`Failed to clear auth data for session ${sessionId} during abort (${reason}):`, cleanupError);
          }
        }

        scheduleSessionRestart(sessionId, reason);
      }

      // Set up event handlers
      client.on('loading_screen', (percent, message) => {
        logger.debug(`Session ${sessionId} loading: ${percent}% - ${message}`);
        console.log(`[${sessionId}] Loading: ${percent}%`);
      });

      // Periodic state check to ensure we catch the connection even if events are missed
      const stateCheckInterval = setInterval(async () => {
        if (isAborted()) {
          clearInterval(stateCheckInterval);
          return;
        }
        try {
          // Only check if we are not already marked as connected in memory
          const currentSession = sessions.get(sessionId);
          if (currentSession && currentSession.info.status === 'connected') {
            return;
          }

          const state = await client.getState();
          logger.debug(`Session ${sessionId} periodic state check: ${state}, client.info: ${client.info ? 'present' : 'missing'}`);

          if (state === 'CONNECTED' || (client.info && client.info.wid)) {
            logger.info(`Session ${sessionId} found CONNECTED via periodic check (State: ${state}, Info: ${Boolean(client.info)}). Updating DB.`);
            console.log(`[${sessionId}] Found CONNECTED via periodic check`);

            clearSessionRestart(sessionId);
            restartCounts.delete(sessionId);

            await updateSessionRecord(sessionId, {
              status: 'connected',
              qrCode: null,
              lastSeen: new Date()
            });
          }
        } catch (err) {
          // Ignore errors during initialization (client might not be ready)
        }
      }, 5000);

      client.on('qr', async (qr) => {
        if (isAborted()) return;

        // Generate QR code for terminal (for debugging) and log it via Winston
        qrcode.generate(qr, { small: true }, (asciiQR) => {
          logger.info(`QR code for session ${sessionId}:\n${asciiQR}`);
        });
        logger.debug(`QR string for session ${sessionId}: ${qr}`);

        // WhatsApp sometimes emits QR payloads with an undefined ref when the session was forcefully logged out.
        // Skip persisting those and force a clean restart so we don't churn a broken QR.
        if (typeof qr === 'string' && qr.startsWith('undefined,')) {
          logger.warn(`Received invalid QR (missing ref) for session ${sessionId}; clearing auth data and restarting`);
          await abortAndRestart('invalid_qr_ref', { clearAuth: true });
          return;
        }

        try {
          // Convert QR string to data URL for dashboard display
          const qrDataUrl = await QRCode.toDataURL(qr);

          const updated = await updateSessionRecord(sessionId, {
            qrCode: qrDataUrl,
            status: 'connecting'
          });

          if (!updated) {
            logger.warn(`Skipping QR persist because session ${sessionId} no longer exists`);
            await safeDestroyClient(sessionId, client);
          } else {
            logger.info(`QR code generated for session ${sessionId}`);
            const existing = sessions.get(sessionId);
            if (existing) {
              existing.info.qrCode = qrDataUrl;
              sessions.set(sessionId, existing);
            }
          }
        } catch (error) {
          logger.error(`Failed to generate QR code for session ${sessionId}:`, error);
        }
      });

      client.on('ready', async () => {
        if (isAborted()) return;
        logger.info(`Session ${sessionId} is ready`);
        console.log(`[${sessionId}] Session is READY`);

        clearSessionRestart(sessionId);
        restartCounts.delete(sessionId); // Reset restart count on success
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
        if (isAborted()) return;
        logger.info(`Session ${sessionId} authenticated`);
        console.log(`[${sessionId}] Session AUTHENTICATED`);

        clearSessionRestart(sessionId);
        restartCounts.delete(sessionId); // Reset restart count on success

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
        if (isAborted()) return;
        logger.info(`Session ${sessionId} state changed to ${state}`);
        if (state === 'CONNECTED') {
          clearSessionRestart(sessionId);
          restartCounts.delete(sessionId); // Reset restart count on success
        }

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
        if (isAborted()) return;
        logger.error(`Session ${sessionId} authentication failed: ${msg}`);

        await updateSessionRecord(sessionId, {
          status: 'disconnected',
          qrCode: null
        });

        await safeDestroyClient(sessionId, client);
        scheduleSessionRestart(sessionId, 'auth_failure');
      });

      client.on('disconnected', async (reason) => {
        if (isAborted()) return;
        logger.info(`Session ${sessionId} disconnected: ${reason}`);

        await updateSessionRecord(sessionId, {
          status: 'disconnected',
          qrCode: null
        });

        await safeDestroyClient(sessionId, client);
        aborted = true;

        // For LOGOUT/NAVIGATION, try to reconnect immediately using existing auth.
        if (reason === 'LOGOUT' || reason === 'NAVIGATION') {
          clearSessionRestart(sessionId);
          try {
            logger.info(`Re-initializing session ${sessionId} after ${reason} without clearing auth`);
            await initializeSession(sessionId);
          } catch (reinitError) {
            logger.error(`Failed to re-initialize session ${sessionId} after ${reason}:`, reinitError);
          }
          return;
        }

        // Other reasons (e.g., transient) just log; no auto-restart timers.
        scheduleSessionRestart(sessionId, `disconnected:${reason}`);
      });

      client.on('error', (error) => {
        logger.error(`Client error for session ${sessionId}:`, error);
        const message = String(error?.message || '');
        if (message.includes('Execution context was destroyed')) {
          scheduleSessionRestart(sessionId, 'execution context destroyed');
        }
      });

      // Handle incoming messages and detect mentions in groups
      client.on('message', async (msg) => {
        try {
          if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') {
            logger.debug(`Skipping status message for session ${sessionId}`);
            return;
          }

          let isMention = false;
          const myId = client.info?.wid?._serialized;
          // Attempt to get LID if available (it might be in client.info.wid.lid or we might need to look elsewhere)
          let myLid = client.info?.wid?.lid?._serialized || client.info?.wid?.lid || client.info?.me?.lid?._serialized || client.info?.me?.lid;
          const myDigits = myId ? myId.replace(/\D/g, '') : null;

          if (msg.from.endsWith('@g.us')) {
            // Check mentions without calling getMentions() to avoid crash
            // msg.mentionedIds is an array of serialized IDs (strings)
            if (msg.mentionedIds && Array.isArray(msg.mentionedIds) && msg.mentionedIds.length > 0) {
              // 1. Check direct ID match (Phone Number ID)
              if (myId && msg.mentionedIds.includes(myId)) {
                isMention = true;
              }
              // 2. Check direct LID match (if we know our LID)
              else if (myLid && msg.mentionedIds.includes(myLid)) {
                isMention = true;
              }
              // 3. Fallback: Resolve mentioned IDs to check if they are "me"
              else {
                for (const mentionedId of msg.mentionedIds) {
                  try {
                    const contact = await client.getContactById(mentionedId);
                    if (contact && contact.isMe) {
                      isMention = true;
                      // Cache the found LID for this session to avoid future lookups
                      if (mentionedId.endsWith('@lid')) {
                        myLid = mentionedId;
                        if (client.info && client.info.wid) {
                          client.info.wid.lid = { _serialized: myLid };
                        }
                      }
                      break;
                    }
                  } catch (err) {
                    // Ignore lookup errors
                  }
                }

                // 4. Fallback: Map LID -> phone number and compare to our digits
                if (!isMention && myDigits) {
                  try {
                    const mappings = await client.getContactLidAndPhone(msg.mentionedIds);
                    for (const mapping of mappings || []) {
                      if (!mapping) continue;
                      const pnDigits = mapping.pn ? mapping.pn.replace(/\D/g, '') : null;
                      if (pnDigits && pnDigits === myDigits) {
                        isMention = true;
                        if (!myLid && mapping.lid) {
                          myLid = mapping.lid;
                          if (client.info && client.info.wid) {
                            client.info.wid.lid = { _serialized: myLid };
                          }
                        }
                        break;
                      }
                      if (myLid && mapping.lid && mapping.lid === myLid) {
                        isMention = true;
                        break;
                      }
                    }
                  } catch (err) {
                    logger.debug(`Failed to resolve mention LID mapping for session ${sessionId}: ${err.message || err}`);
                  }
                }
              }
            }

            logger.debug(`Group message check: from=${msg.from}, myId=${myId}, myLid=${myLid}, mentionedIds=${JSON.stringify(msg.mentionedIds)}, isMention=${isMention}`);

            // If it is a group message and the bot is NOT mentioned, ignore it completely
            if (!isMention) {
              // logger.debug(`Ignoring group message from ${msg.from} because bot was not mentioned`);
              return;
            }
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
        if (isAborted()) return;
        try {
          setTypingStatus(sessionId, chat?.id?._serialized, true);
        } catch (error) {
          logger.warn(`Failed to record typing state for session ${sessionId}:`, error);
        }
      });

      client.on('stop_typing', (chat) => {
        if (isAborted()) return;
        try {
          setTypingStatus(sessionId, chat?.id?._serialized, false);
        } catch (error) {
          logger.warn(`Failed to clear typing state for session ${sessionId}:`, error);
        }
      });

      // Initialize the client
      try {
        await client.initialize();
      } catch (initError) {
        logger.error(`Client initialization failed for session ${sessionId}:`, initError);
        await updateSessionRecord(sessionId, {
          status: 'disconnected',
          qrCode: null
        });
        await safeDestroyClient(sessionId, client);
        scheduleSessionRestart(sessionId, 'initialize failure');
        throw initError;
      }

      // Store session in map
      if (!isAborted()) {
        sessions.set(sessionId, {
          client,
          cleanup: () => {
            aborted = true;
            clearInterval(stateCheckInterval);
          },
          info: {
            id: sessionId,
            name: session.sessionName,
            status: session.status,
            qrCode: null
          }
        });
      } else {
        return null;
      }

      return sessions.get(sessionId);
    } catch (error) {
      logger.error(`Error initializing session ${sessionId}:`, error);

      await updateSessionRecord(sessionId, {
        status: 'disconnected',
        qrCode: null
      });

      const runtime = sessions.get(sessionId);
      if (runtime?.client) {
        await safeDestroyClient(sessionId, runtime.client);
      }

      scheduleSessionRestart(sessionId, 'initialize exception');

      throw error;
    } finally {
      initializingSessions.delete(sessionId);
    }
  })();

  initializingSessions.set(sessionId, initPromise);
  return initPromise;
}

async function restartSession(sessionId) {
  try {
    const existingSession = sessions.get(sessionId);

    if (existingSession) {
      if (typeof existingSession.cleanup === 'function') {
        existingSession.cleanup();
      }

      try {
        await existingSession.client.destroy();
      } catch (error) {
        logger.warn(`Failed to destroy existing client for session ${sessionId}:`, error);
      }

      sessions.delete(sessionId);
      typingStatus.delete(sessionId);
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'connecting',
        qrCode: null
      }
    });

    logger.info(`Restarting session ${sessionId} to refresh QR code`);

    return initializeSession(sessionId);
  } catch (error) {
    logger.error(`Failed to restart session ${sessionId}:`, error);
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
    clearSessionRestart(sessionId);

    const session = sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found in memory; marking as disconnected`);

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'disconnected',
          qrCode: null
        }
      });

      try {
        await removeSessionAuthData(sessionId);
      } catch (cleanupError) {
        logger.warn(`Failed to clean up auth data for missing session ${sessionId}:`, cleanupError);
      }

      return false;
    }

    // Cleanup background tasks
    if (typeof session.cleanup === 'function') {
      session.cleanup();
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

  const contactPushName = chat.contact?.pushname || chat.contact?.shortName || null;
  if (!chat.isGroup && contactPushName) {
    return contactPushName;
  }

  if (chat.isGroup) {
    if (chat.formattedTitle) {
      return chat.formattedTitle;
    }

    if (chat.name) {
      return chat.name;
    }
  }

  if (contactPushName) {
    return contactPushName;
  }

  if (chat.formattedTitle) {
    return chat.formattedTitle;
  }

  if (chat.isGroup && chat.id && chat.id.user) {
    return chat.id.user;
  }

  if (chat.id && chat.id.user) {
    return chat.id.user;
  }

  return chat.id?._serialized || 'Unknown chat';
}

/**
 * Remove the persisted authentication data for a session
 * @param {number} sessionId - The session ID
 * @returns {Promise<boolean>} - True if the auth data directory was removed
 */
async function removeSessionAuthData(sessionId) {
  const baseDir = process.env.WWEBJS_DATA_DIR || '.wwebjs_auth';
  const sessionDir = path.join(baseDir, `session-${sessionId}`);
  const legacySessionDir = path.join(baseDir, `session-session-${sessionId}`);

  try {
    await fsPromises.rm(sessionDir, { recursive: true, force: true });
    logger.info(`Removed auth data for session ${sessionId} at ${sessionDir}`);

    if (fs.existsSync(legacySessionDir)) {
      await fsPromises.rm(legacySessionDir, { recursive: true, force: true });
      logger.info(`Removed legacy auth directory for session ${sessionId} at ${legacySessionDir}`);
    }

    return true;
  } catch (error) {
    logger.error(`Failed to remove auth data for session ${sessionId} at ${sessionDir}:`, error);
    throw error;
  }
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
          name: contact?.pushname || contact?.shortName || contact?.name || participant.id.user,
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
  removeSessionAuthData,
  getSessionChats,
  getSessionGroups,
  getGroupParticipants,
  restartSession
};
