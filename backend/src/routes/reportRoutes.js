const express = require('express');
const { listReports, createReport, reviewReport } = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listReports);
router.post('/', requireAuth, createReport);
router.patch('/:id/review', requireAuth, requireRole('CONSULTANT', 'ADMIN'), reviewReport);

module.exports = router;
