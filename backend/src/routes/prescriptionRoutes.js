const express = require('express');
const {
  listPrescriptions, createPrescription, updatePrescriptionStatus,
} = require('../controllers/prescriptionController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listPrescriptions);
router.post('/', requireAuth, requireRole('CONSULTANT', 'ADMIN'), createPrescription);
router.patch('/:id/status', requireAuth, updatePrescriptionStatus);

module.exports = router;
