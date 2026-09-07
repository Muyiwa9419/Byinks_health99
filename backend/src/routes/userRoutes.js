const express = require('express');

const {
  getAllUsers,
  getConsultants,
  getDispatchers,
  getProfile,
  updateProfile,
  adminCreateUser,
  removeUser,
  updateUserStatus,
  changePassword,
} = require('../controllers/userController');

const {
  requireAuth,
  requireRole,
} = require('../middleware/auth');

const router = express.Router();

// Admin-only complete user list
router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  getAllUsers
);

// Authenticated users can see approved consultants
router.get(
  '/consultants',
  requireAuth,
  getConsultants
);

// Pharmacy can see verified dispatch partners
router.get(
  '/dispatchers',
  requireAuth,
  requireRole('PHARMACY', 'ADMIN'),
  getDispatchers
);

// IMPORTANT:
// Specific routes must come before /:userId
router.patch(
  '/change-password',
  requireAuth,
  changePassword
);

router.get(
  '/:userId',
  requireAuth,
  getProfile
);

router.patch(
  '/:userId',
  requireAuth,
  updateProfile
);

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  adminCreateUser
);

router.delete(
  '/:userId',
  requireAuth,
  requireRole('ADMIN'),
  removeUser
);

router.patch(
  '/:userId/status',
  requireAuth,
  requireRole('ADMIN'),
  updateUserStatus
);

module.exports = router;