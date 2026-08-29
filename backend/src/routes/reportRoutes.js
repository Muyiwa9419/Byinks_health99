const express = require('express');

const {
  listReports,
  createReport,
  getReportFile,
  reviewReport,
  uploadReport,
} = require('../controllers/reportController');

const {
  requireAuth,
  requireRole,
} = require('../middleware/auth');

const router = express.Router();

// List reports
router.get(
  '/',
  requireAuth,
  listReports
);

// Upload actual medical report file
router.post(
  '/upload',
  requireAuth,
  uploadReport
);

// Create report record
router.post(
  '/',
  requireAuth,
  createReport
);

// Get report file
router.get(
  '/:id/file',
  requireAuth,
  getReportFile
);

// Review/vet report
router.patch(
  '/:id/review',
  requireAuth,
  requireRole('CONSULTANT', 'ADMIN'),
  reviewReport
);

module.exports = router;