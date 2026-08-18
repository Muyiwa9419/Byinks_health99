const express = require('express');

const {
  getAllUsers,
  getConsultants,
  getProfile,
  updateProfile,
  adminCreateUser,
  removeUser,
  updateUserStatus,
  changePassword,
} = require('../controllers/userController');

const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('ADMIN'), getAllUsers);

router.get('/consultants', requireAuth, getConsultants);

// IMPORTANT: this must come BEFORE /:userId
router.patch('/change-password', requireAuth, changePassword);

router.get('/:userId', requireAuth, getProfile);
router.patch('/:userId', requireAuth, updateProfile);
router.post('/', requireAuth, requireRole('ADMIN'), adminCreateUser);
router.delete('/:userId', requireAuth, requireRole('ADMIN'), removeUser);
router.patch('/:userId/status', requireAuth, requireRole('ADMIN'), updateUserStatus);

module.exports = router;