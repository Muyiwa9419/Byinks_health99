const express = require('express');
const multer = require('multer');


const {
  listReports,
  createReport,
  uploadReport,
  getReportFile,
  reviewReport,
} = require('../controllers/reportController');

const {
  requireAuth,
  requireRole,
} = require('../middleware/auth');

const router = express.Router();



const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});


router.get('/upload-test', (req, res) => {
  res.json({
    success: true,
    message: 'New report routes deployed',
  });
});

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
  upload.single('file'),
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