const express = require('express');
const multer = require('multer');
const messageController = require('../controllers/message.controller');

const router = express.Router();
const upload = multer();

/**
 * @route   GET /api/messages/:id
 * @desc    Get a message by ID
 * @access  Public
 */
router.get('/:id', messageController.getMessageById);

/**
 * @route   GET /api/messages/session/:sessionId
 * @desc    Get messages for a session
 * @access  Public
 */
router.get('/session/:sessionId', messageController.getMessages);

/**
 * @route   POST /api/messages/session/:sessionId/send
 * @desc    Send a message
 * @access  Public
 */
router.post(
  '/session/:sessionId/send',
  upload.single('media'),
  messageController.sendMessageHandler
);

module.exports = router;
