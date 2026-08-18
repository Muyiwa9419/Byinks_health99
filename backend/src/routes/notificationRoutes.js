const express = require('express');
const { listNotifications, createNotification, markRead } = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:userId', requireAuth, listNotifications);
router.post('/', requireAuth, createNotification);
router.patch('/:id/read', requireAuth, markRead);

module.exports = router;
