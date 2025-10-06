const express = require('express');
const sessionController = require('../controllers/session.controller');

const router = express.Router();

/**
 * @route   GET /api/sessions
 * @desc    Get all sessions
 * @access  Public
 */
router.get('/', sessionController.getAllSessions);

/**
 * @route   GET /api/sessions/:id
 * @desc    Get a session by ID
 * @access  Public
 */
router.get('/:id', sessionController.getSessionById);

/**
 * @route   POST /api/sessions
 * @desc    Create a new session
 * @access  Public
 */
router.post('/', sessionController.createSession);

/**
 * @route   PUT /api/sessions/:id
 * @desc    Update a session
 * @access  Public
 */
router.put('/:id', sessionController.updateSession);

/**
 * @route   DELETE /api/sessions/:id
 * @desc    Delete a session
 * @access  Public
 */
router.delete('/:id', sessionController.deleteSession);

/**
 * @route   POST /api/sessions/:id/start
 * @desc    Start a session
 * @access  Public
 */
router.post('/:id/start', sessionController.startSession);

/**
 * @route   POST /api/sessions/:id/stop
 * @desc    Stop a session
 * @access  Public
 */
router.post('/:id/stop', sessionController.stopSession);

/**
 * @route   GET /api/sessions/:id/qr
 * @desc    Get session QR code
 * @access  Public
 */
router.get('/:id/qr', sessionController.getSessionQR);

/**
 * @route   GET /api/sessions/:id/chats
 * @desc    Get chats for a session
 * @access  Public
 */
router.get('/:id/chats', sessionController.getSessionChats);

/**
 * @route   GET /api/sessions/:id/groups
 * @desc    Get WhatsApp groups for a session
 * @access  Public
 */
router.get('/:id/groups', sessionController.getSessionGroups);

/**
 * @route   GET /api/sessions/:id/groups/:groupId/members
 * @desc    Get members for a WhatsApp group
 * @access  Public
 */
router.get('/:id/groups/:groupId/members', sessionController.getGroupMembers);

module.exports = router;
