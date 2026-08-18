const { User, Appointment, ConsultantAvailability } = require('../models');

async function listAppointments(req, res) {
  try {
    const { patientId, consultantId } = req.query;

    const where = {};

    // Patients can only see their own appointments
    if (req.user.role === 'PATIENT') {
      where.patientId = req.user.id;
    }

    // Consultants can only see their own appointments
    else if (req.user.role === 'CONSULTANT') {
      where.consultantId = req.user.id;
    }

    // Admin can filter freely
    else if (req.user.role === 'ADMIN') {
      if (patientId) where.patientId = patientId;
      if (consultantId) where.consultantId = consultantId;
    }

    // Pharmacy / dispatch shouldn't access the appointment registry
    else {
      return res.status(403).json({
        error: 'You are not authorized to view appointments'
      });
    }

    const appointments = await Appointment.findAll({
      where,
      order: [
        ['date', 'ASC'],
        ['time', 'ASC']
      ]
    });

    res.json(appointments);

  } catch (error) {
    console.error('List appointments error:', error);

    res.status(500).json({
      error: 'Failed to fetch appointments'
    });
  }
}

async function createAppointment(req, res) {
  try {
    const {
      consultantId,
      date,
      time,
      notes,
      fee
    } = req.body;

    // Validate required fields
    if (!consultantId || !date || !time) {
      return res.status(400).json({
        error: 'Consultant, date, and time are required'
      });
    }

    // Patient comes from the authenticated user
    const patientId = req.user.id;
    const patientName = req.user.name;

    // Make sure the selected consultant exists
    const consultant = await User.findByPk(consultantId);

    if (!consultant) {
      return res.status(404).json({
        error: 'Consultant not found'
      });
    }

    // Make sure the selected user is actually a consultant
    if (consultant.role !== 'CONSULTANT') {
      return res.status(400).json({
        error: 'Selected user is not a consultant'
      });
    }

    const consultantName = consultant.name;

    // Create appointment
    const appt = await Appointment.create({
  patientId,
  patientName,
  consultantId,
  consultantName,
  date,
  time,
  notes: notes || null,
  fee: fee || 45,
  status: 'pending',
  paymentStatus: 'pending'
});

return res.status(201).json(appt);

  } catch (error) {
    console.error('Create appointment error:', error);

    return res.status(500).json({
      error: 'Failed to create appointment',
      message: error.message
    });
  }
}

async function updateAppointment(req, res) {
  try {
    const appt = await Appointment.findByPk(req.params.id);

    if (!appt) {
      return res.status(404).json({
        error: 'Appointment not found'
      });
    }

    const { status, notes, fee, paymentStatus } = req.body;

    // Consultant can update appointment status/notes
    if (req.user.role === 'CONSULTANT') {
      if (appt.consultantId !== req.user.id) {
        return res.status(403).json({
          error: 'You are not authorized to update this appointment'
        });
      }

      await appt.update({
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes })
      });

      return res.json(appt);
    }

    // Patient can update their own appointment
if (req.user.role === 'PATIENT') {
  if (appt.patientId !== req.user.id) {
    return res.status(403).json({
      error: 'You are not authorized to update this appointment'
    });
  }

  await appt.update({
    ...(status !== undefined && { status }),
    ...(notes !== undefined && { notes })
  });

  return res.json(appt);
}

    // Admin can update allowed administrative fields
    if (req.user.role === 'ADMIN') {
      await appt.update({
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(fee !== undefined && { fee }),
        ...(paymentStatus !== undefined && { paymentStatus })
      });

      return res.json(appt);
    }

    return res.status(403).json({
      error: 'You are not authorized to update appointments'
    });

  } catch (error) {
    console.error('Update appointment error:', error);

    res.status(500).json({
      error: 'Failed to update appointment'
    });
  }
}

async function cancelAppointment(req, res) {
  try {
    const appt = await Appointment.findByPk(req.params.id);

    if (!appt) {
      return res.status(404).json({
        error: 'Appointment not found'
      });
    }

    // Patient can cancel their own appointment
    if (req.user.role === 'PATIENT' && appt.patientId !== req.user.id) {
      return res.status(403).json({
        error: 'You are not authorized to cancel this appointment'
      });
    }

    // Consultant can cancel their own appointment
    if (req.user.role === 'CONSULTANT' && appt.consultantId !== req.user.id) {
      return res.status(403).json({
        error: 'You are not authorized to cancel this appointment'
      });
    }

    // Only patient, consultant, or admin can cancel
    if (!['PATIENT', 'CONSULTANT', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'You are not authorized to cancel appointments'
      });
    }

    appt.status = 'cancelled';
    await appt.save();

    res.json(appt);

  } catch (error) {
    console.error('Cancel appointment error:', error);

    res.status(500).json({
      error: 'Failed to cancel appointment'
    });
  }
}


async function rescheduleAppointment(req, res) {
  try {
    const { date, time } = req.body;

    if (!date || !time) {
      return res.status(400).json({
        error: 'Date and time are required'
      });
    }

    const appt = await Appointment.findByPk(req.params.id);

    if (!appt) {
      return res.status(404).json({
        error: 'Appointment not found'
      });
    }

    // Patient can reschedule their own appointment
    if (req.user.role === 'PATIENT' && appt.patientId !== req.user.id) {
      return res.status(403).json({
        error: 'You are not authorized to reschedule this appointment'
      });
    }

    // Consultant can reschedule their own appointment
    if (req.user.role === 'CONSULTANT' && appt.consultantId !== req.user.id) {
      return res.status(403).json({
        error: 'You are not authorized to reschedule this appointment'
      });
    }

    if (!['PATIENT', 'CONSULTANT', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'You are not authorized to reschedule appointments'
      });
    }

    appt.date = date;
    appt.time = time;
    appt.status = 'pending';

    await appt.save();

    res.json(appt);

  } catch (error) {
    console.error('Reschedule appointment error:', error);

    res.status(500).json({
      error: 'Failed to reschedule appointment'
    });
  }
}

async function getAvailability(req, res) {
  try {
    const { consultantId } = req.params;

    const availability =
      await ConsultantAvailability.findOne({
        where: {
          consultantId
        }
      });

    return res.json(
      availability || {
        consultantId,
        blockedSlots: {}
      }
    );

  } catch (error) {
    console.error(
      'Get availability error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to fetch availability'
    });
  }
}


async function setAvailability(req, res) {
  try {
    const { consultantId } = req.params;
    const { blockedSlots } = req.body;

    // Only the consultant themselves or an admin
    // can modify this consultant's availability.
    if (
      req.user.role === 'CONSULTANT' &&
      req.user.id !== consultantId
    ) {
      return res.status(403).json({
        error: 'You are not authorized to modify this availability'
      });
    }

    if (!['CONSULTANT', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'You are not authorized to modify availability'
      });
    }

    const [availability] = await ConsultantAvailability.findOrCreate({
      where: {
        consultantId
      },
      defaults: {
        blockedSlots: blockedSlots || {}
      }
    });

    availability.blockedSlots = blockedSlots || {};

    await availability.save();

    res.json(availability);

  } catch (error) {
    console.error('Set availability error:', error);

    res.status(500).json({
      error: 'Failed to update availability'
    });
  }
}

module.exports = {
  listAppointments, createAppointment, updateAppointment, cancelAppointment,
  rescheduleAppointment, getAvailability, setAvailability,
};
