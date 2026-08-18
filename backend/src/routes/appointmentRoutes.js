const express = require('express');
const {
  listAppointments, createAppointment, updateAppointment, cancelAppointment,
  rescheduleAppointment, getAvailability, setAvailability,
} = require('../controllers/appointmentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listAppointments);
router.post('/', requireAuth, createAppointment);
router.patch('/:id', requireAuth, updateAppointment);
router.post('/:id/cancel', requireAuth, cancelAppointment);
router.post('/:id/reschedule', requireAuth, rescheduleAppointment);

router.get('/availability/:consultantId', requireAuth, getAvailability);
router.put('/availability/:consultantId', requireAuth, setAvailability);

module.exports = router;
