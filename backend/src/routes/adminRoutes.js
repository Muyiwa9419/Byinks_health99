const express = require('express');

const {
  getPatientConsultantAssignments,
  getConsultantActivity,
} = require('../controllers/adminController');

const {
  requireAuth,
  requireRole,
} = require('../middleware/auth');

const router = express.Router();

/*
 * Admin only
 */

/*
 * Shows which consultants are attached
 * to which patients.
 */
router.get(
  '/patient-consultants',
  requireAuth,
  requireRole('ADMIN'),
  getPatientConsultantAssignments
);

/*
 * Shows the activity of one consultant.
 */
router.get(
  '/consultants/:consultantId/activity',
  requireAuth,
  requireRole('ADMIN'),
  getConsultantActivity
);

module.exports = router;