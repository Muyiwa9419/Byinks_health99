const {
  User,
  Appointment,
  MedicalReport,
  Prescription,
  ChatThread,
} = require('../models');

const { Op } = require('sequelize');

/*
 * Get all patients with their assigned consultants
 */
const getPatientConsultantAssignments = async (req, res) => {
  try {
    const patients = await User.findAll({
      where: {
        role: 'PATIENT',
      },
      attributes: [
        'id',
        'name',
        'email',
        'phone',
      ],
      order: [['name', 'ASC']],
    });

    const appointments = await Appointment.findAll({
      order: [['createdAt', 'DESC']],
    });

    const consultants = await User.findAll({
      where: {
        role: 'CONSULTANT',
      },
      attributes: [
        'id',
        'name',
        'email',
        'specialty',
        'isApproved',
        'isOnline',
      ],
    });

    const consultantMap = {};

    consultants.forEach((consultant) => {
      consultantMap[consultant.id] = consultant;
    });

    const patientMap = {};

    patients.forEach((patient) => {
      patientMap[patient.id] = {
        patient: patient,
        consultants: [],
      };
    });

    appointments.forEach((appointment) => {
      if (!patientMap[appointment.patientId]) {
        return;
      }

      const consultant =
        consultantMap[appointment.consultantId];

      if (!consultant) {
        return;
      }

      const existing =
        patientMap[appointment.patientId].consultants
          .find(
            c => c.consultantId === appointment.consultantId
          );

      if (existing) {
        existing.appointmentCount += 1;

        if (
          new Date(appointment.createdAt) >
          new Date(existing.lastActivity)
        ) {
          existing.lastActivity =
            appointment.createdAt;
        }
      } else {
        patientMap[appointment.patientId].consultants.push({
          consultantId: consultant.id,
          consultantName: consultant.name,
          consultantEmail: consultant.email,
          specialty: consultant.specialty,
          isApproved: consultant.isApproved,
          isOnline: consultant.isOnline,
          appointmentCount: 1,
          lastActivity: appointment.createdAt,
        });
      }
    });

    return res.json(
      Object.values(patientMap)
    );

  } catch (error) {
    console.error(
      'Get patient consultant assignments error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to load patient consultant assignments',
      message: error.message,
    });
  }
};


/*
 * Get activity for a particular consultant
 */
const getConsultantActivity = async (req, res) => {
  try {
    const { consultantId } = req.params;

    const consultant = await User.findOne({
      where: {
        id: consultantId,
        role: 'CONSULTANT',
      },
      attributes: [
        'id',
        'name',
        'email',
        'specialty',
        'isApproved',
        'isOnline',
      ],
    });

    if (!consultant) {
      return res.status(404).json({
        error: 'Consultant not found',
      });
    }

    const appointments = await Appointment.findAll({
      where: {
        consultantId,
      },
      order: [['createdAt', 'DESC']],
    });

    const reports = await MedicalReport.findAll({
      where: {
        vettedBy: consultantId,
      },
      order: [['createdAt', 'DESC']],
    });

    const prescriptions = await Prescription.findAll({
      where: {
        consultantId,
      },
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      consultant,

      summary: {
        appointments: appointments.length,
        reportsReviewed: reports.length,
        prescriptions: prescriptions.length,
      },

      appointments,
      reports,
      prescriptions,
    });

  } catch (error) {
    console.error(
      'Get consultant activity error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to load consultant activity',
      message: error.message,
    });
  }
};


module.exports = {
  getPatientConsultantAssignments,
  getConsultantActivity,
};