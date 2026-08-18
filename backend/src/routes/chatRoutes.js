const express = require('express');
const {
  getActiveThreads, getMessages, postMessage, endSession,
} = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/threads/:userId', requireAuth, getActiveThreads);
router.get('/:chatId/messages', requireAuth, getMessages);
router.post('/:chatId/messages', requireAuth, postMessage);
router.post('/:chatId/end', requireAuth, endSession);

module.exports = router;
