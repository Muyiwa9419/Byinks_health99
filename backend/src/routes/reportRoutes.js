
const express = require('express');

const {
  listReports,
  createReport,
  getReportFile,
  reviewReport,
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

// Create/upload report record
router.post(
  '/',
  requireAuth,
  createReport
);

// Get a secure report file URL
router.get(
  '/:id/file',
  requireAuth,
  getReportFile
);

// Review/vet a report
router.patch(
  '/:id/review',
  requireAuth,
  requireRole('CONSULTANT', 'ADMIN'),
  reviewReport
);

router.get('/test-route', (req, res) => {
  res.json({
    success: true,
    message: 'REPORT ROUTES ARE WORKING',
  });
});
module.exports = router;

