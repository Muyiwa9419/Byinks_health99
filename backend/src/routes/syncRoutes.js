const express = require('express');
const {
  listSyncRequests, createSyncRequest, updateSyncRequestStatus,
} = require('../controllers/syncController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('ADMIN'), listSyncRequests);
router.post('/', createSyncRequest); // unauthenticated - a device requesting sync approval
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), updateSyncRequestStatus);

module.exports = router;
