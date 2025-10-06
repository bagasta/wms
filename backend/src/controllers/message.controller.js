const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { sendMessage } = require('../services/messageHandler');

const prisma = new PrismaClient();

/**
 * Get messages for a session
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function getMessages(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0, phone } = req.query;

    // Build query
    const query = {
      where: {
        sessionId: parseInt(sessionId)
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    };

    // Add phone filter if provided
    if (phone) {
      query.where.OR = [
        { fromNumber: { contains: phone } },
        { toNumber: { contains: phone } }
      ];
    }

    // Get messages
    const messages = await prisma.message.findMany(query);

    // Get total count
    const totalCount = await prisma.message.count({
      where: query.where
    });

    res.status(200).json({
      status: 'success',
      data: {
        messages,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting messages for session ${req.params.sessionId}:`, error);
    next(error);
  }
}

/**
 * Send a message
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function sendMessageHandler(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { to } = req.body;
    const message = typeof req.body.message === 'string' ? req.body.message : '';
    const captionField =
      typeof req.body.caption === 'string' && req.body.caption.trim() !== ''
        ? req.body.caption
        : null;
    const uploadedFile = req.file;
    let rawMedia = req.body.media;
    const mediaTypeField =
      typeof req.body.mediaType === 'string' && req.body.mediaType.trim() !== ''
        ? req.body.mediaType.trim().toLowerCase()
        : null;
    const mediaMimeTypeField =
      typeof req.body.mediaMimeType === 'string' && req.body.mediaMimeType.trim() !== ''
        ? req.body.mediaMimeType.trim()
        : null;
    const mediaFilenameField =
      typeof req.body.mediaFilename === 'string' && req.body.mediaFilename.trim() !== ''
        ? req.body.mediaFilename.trim()
        : null;

    if (!to) {
      return res.status(400).json({
        status: 'error',
        message: 'Recipient (to) is required'
      });
    }

    const hasMessage = message.trim() !== '';

    let mediaPayload = null;

    if (uploadedFile) {
      if (!uploadedFile.mimetype || !uploadedFile.mimetype.startsWith('image/')) {
        return res.status(400).json({
          status: 'error',
          message: 'Uploaded media must be an image file'
        });
      }

      mediaPayload = {
        type: 'image',
        data: uploadedFile.buffer.toString('base64'),
        mimetype: uploadedFile.mimetype,
        filename: uploadedFile.originalname,
        caption: captionField ?? (hasMessage ? message : undefined)
      };
    }

    if (!mediaPayload && rawMedia) {
      let parsedMedia = rawMedia;

      if (typeof rawMedia === 'string') {
        const trimmed = rawMedia.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            parsedMedia = JSON.parse(trimmed);
          } catch (error) {
            return res.status(400).json({
              status: 'error',
              message: 'Media payload must be valid JSON'
            });
          }
        } else {
          const effectiveType = mediaTypeField || 'image';
          if (effectiveType !== 'image') {
            return res.status(400).json({
              status: 'error',
              message: 'Only image media type is currently supported'
            });
          }

          if (!mediaMimeTypeField) {
            return res.status(400).json({
              status: 'error',
              message: 'Media mimetype is required when providing base64 data'
            });
          }

          mediaPayload = {
            type: effectiveType,
            data: trimmed,
            mimetype: mediaMimeTypeField,
            filename: mediaFilenameField || undefined,
            caption: captionField ?? (hasMessage ? message : undefined)
          };
        }
      }

      if (!mediaPayload) {
        const hasMediaObject = parsedMedia && typeof parsedMedia === 'object';
        if (hasMediaObject) {
          const {
            type,
            url = null,
            data = null,
            mimetype = null,
            filename = null,
            caption = null
          } = parsedMedia;

          if (!type || type !== 'image') {
            return res.status(400).json({
              status: 'error',
              message: 'Only image media type is currently supported'
            });
          }

          if (!url && !data) {
            return res.status(400).json({
              status: 'error',
              message: 'Media payload must include either a url or base64 data field'
            });
          }

          if (data && !mimetype) {
            return res.status(400).json({
              status: 'error',
              message: 'Media mimetype is required when providing base64 data'
            });
          }

          mediaPayload = {
            type,
            url,
            data,
            mimetype,
            filename,
            caption: caption ?? captionField ?? (hasMessage ? message : undefined)
          };
        }
      }
    }

    if (!hasMessage && !mediaPayload) {
      return res.status(400).json({
        status: 'error',
        message: 'Either message text or media payload is required'
      });
    }

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { id: parseInt(sessionId) }
    });

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: `Session with ID ${sessionId} not found`
      });
    }

    // Check if session is connected
    if (session.status !== 'connected') {
      return res.status(400).json({
        status: 'error',
        message: `Session ${sessionId} is not connected`
      });
    }

    // Send message
    const caption = mediaPayload?.caption ?? (captionField ?? (hasMessage ? message : ''));
    const sentMessage = await sendMessage(
      parseInt(sessionId),
      to,
      caption,
      mediaPayload
        ? { media: mediaPayload }
        : {}
    );

    res.status(200).json({
      status: 'success',
      data: sentMessage
    });
  } catch (error) {
    logger.error(`Error sending message for session ${req.params.sessionId}:`, error);
    next(error);
  }
}

/**
 * Get a message by ID
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function getMessageById(req, res, next) {
  try {
    const { id } = req.params;
    
    const message = await prisma.message.findUnique({
      where: { id: parseInt(id) }
    });

    if (!message) {
      return res.status(404).json({
        status: 'error',
        message: `Message with ID ${id} not found`
      });
    }

    res.status(200).json({
      status: 'success',
      data: message
    });
  } catch (error) {
    logger.error(`Error getting message ${req.params.id}:`, error);
    next(error);
  }
}

module.exports = {
  getMessages,
  sendMessageHandler,
  getMessageById
};
