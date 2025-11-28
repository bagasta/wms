const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { sendMessage } = require('../services/messageHandler');

/**
 * Handle incoming webhook
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function handleWebhook(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { message_id, reply_to, reply_message } = req.body;

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

    // If reply_to and reply_message are provided, send a reply
    if (reply_to && reply_message) {
      try {
        const sentMessage = await sendMessage(parseInt(sessionId), reply_to, reply_message);

        return res.status(200).json({
          status: 'success',
          data: {
            message: 'Reply sent successfully',
            sentMessage
          }
        });
      } catch (error) {
        logger.error(`Error sending reply for session ${sessionId}:`, error);
        return res.status(500).json({
          status: 'error',
          message: `Error sending reply: ${error.message}`
        });
      }
    }

    // If no reply is requested, just acknowledge receipt
    res.status(200).json({
      status: 'success',
      message: 'Webhook received'
    });
  } catch (error) {
    logger.error(`Error handling webhook for session ${req.params.sessionId}:`, error);
    next(error);
  }
}

/**
 * Register a webhook
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function registerWebhook(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { url, secret, events = ['message'] } = req.body;

    // Validate required fields
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'Webhook URL is required'
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

    // Check if webhook already exists
    const existingWebhook = await prisma.webhook.findFirst({
      where: {
        sessionId: parseInt(sessionId),
        url
      }
    });

    if (existingWebhook) {
      // Update existing webhook
      const webhook = await prisma.webhook.update({
        where: { id: existingWebhook.id },
        data: {
          secret,
          events,
          active: true
        }
      });

      logger.info(`Webhook ${webhook.id} updated for session ${sessionId}`);

      return res.status(200).json({
        status: 'success',
        data: webhook
      });
    }

    // Create new webhook
    const webhook = await prisma.webhook.create({
      data: {
        sessionId: parseInt(sessionId),
        url,
        secret,
        events,
        active: true
      }
    });

    logger.info(`Webhook ${webhook.id} registered for session ${sessionId}`);

    res.status(201).json({
      status: 'success',
      data: webhook
    });
  } catch (error) {
    logger.error(`Error registering webhook for session ${req.params.sessionId}:`, error);
    next(error);
  }
}

/**
 * Get webhooks for a session
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function getWebhooks(req, res, next) {
  try {
    const { sessionId } = req.params;

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

    // Get webhooks
    const webhooks = await prisma.webhook.findMany({
      where: {
        sessionId: parseInt(sessionId)
      }
    });

    res.status(200).json({
      status: 'success',
      data: webhooks
    });
  } catch (error) {
    logger.error(`Error getting webhooks for session ${req.params.sessionId}:`, error);
    next(error);
  }
}

/**
 * Delete a webhook
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
async function deleteWebhook(req, res, next) {
  try {
    const { id } = req.params;

    // Check if webhook exists
    const webhook = await prisma.webhook.findUnique({
      where: { id: parseInt(id) }
    });

    if (!webhook) {
      return res.status(404).json({
        status: 'error',
        message: `Webhook with ID ${id} not found`
      });
    }

    // Delete webhook
    await prisma.webhook.delete({
      where: { id: parseInt(id) }
    });

    logger.info(`Webhook ${id} deleted`);

    res.status(200).json({
      status: 'success',
      message: `Webhook ${id} deleted successfully`
    });
  } catch (error) {
    logger.error(`Error deleting webhook ${req.params.id}:`, error);
    next(error);
  }
}

module.exports = {
  handleWebhook,
  registerWebhook,
  getWebhooks,
  deleteWebhook
};

