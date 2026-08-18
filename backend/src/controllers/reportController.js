const { MedicalReport, Appointment } = require('../models');


// =====================================================
// GET /api/reports
// =====================================================
async function listReports(req, res) {
  try {
    const { patientId, status } = req.query;

    const where = {};

    // PATIENT
    // A patient can only see their own reports.
    if (req.user.role === 'PATIENT') {
      where.patientId = req.user.id;
    }

    // CONSULTANT
    // Consultant can only see reports belonging to
    // patients who have appointments with them.
    else if (req.user.role === 'CONSULTANT') {

      const appointments = await Appointment.findAll({
        where: {
          consultantId: req.user.id
        },
        attributes: ['patientId'],
        raw: true
      });

      const patientIds = [
        ...new Set(
          appointments
            .map(appointment => appointment.patientId)
            .filter(Boolean)
        )
      ];

      if (patientIds.length === 0) {
        return res.json([]);
      }

      if (patientId) {
        if (!patientIds.includes(patientId)) {
          return res.status(403).json({
            error: 'You are not authorized to view this patient reports'
          });
        }

        where.patientId = patientId;
      } else {
        where.patientId = patientIds;
      }
    }

    // ADMIN
    else if (req.user.role === 'ADMIN') {
      if (patientId) {
        where.patientId = patientId;
      }
    }

    // Other roles
    else {
      return res.status(403).json({
        error: 'You are not authorized to view medical reports'
      });
    }

    // Optional status filter
    if (status) {
      where.status = status;
    }

    const reports = await MedicalReport.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    return res.json(reports);

  } catch (error) {
    console.error('List reports error:', error);

    return res.status(500).json({
      error: 'Failed to fetch reports',
      message: error.message
    });
  }
}


// =====================================================
// POST /api/reports
// =====================================================
async function createReport(req, res) {
  try {

    // A patient must create a report for themselves.
    let patientId = req.body.patientId;

    if (req.user.role === 'PATIENT') {
      patientId = req.user.id;
    }

    if (!patientId) {
      return res.status(400).json({
        error: 'Patient ID is required'
      });
    }

    const report = await MedicalReport.create({
      ...req.body,
      patientId,
      status: req.body.status || 'pending_review'
    });

    return res.status(201).json(report);

  } catch (error) {
    console.error('Create report error:', error);

    return res.status(500).json({
      error: 'Failed to create report',
      message: error.message
    });
  }
}


// =====================================================
// PATCH /api/reports/:id/review
// =====================================================
async function reviewReport(req, res) {
  try {

    const { status, consultantNote } = req.body;

    const report = await MedicalReport.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Consultant must have an appointment with this patient.
    if (req.user.role === 'CONSULTANT') {

      const appointment = await Appointment.findOne({
        where: {
          consultantId: req.user.id,
          patientId: report.patientId
        }
      });

      if (!appointment) {
        return res.status(403).json({
          error: 'You are not authorized to review this report'
        });
      }
    }

    // Only allow valid review statuses
    const allowedStatuses = [
      'pending_review',
      'vetted',
      'rejected',
      'clear'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid report status'
      });
    }

    await report.update({
      status,
      consultantNote,
      vettedBy: req.user.id
    });

    return res.json(report);

  } catch (error) {
    console.error('Review report error:', error);

    return res.status(500).json({
      error: 'Failed to review report',
      message: error.message
    });
  }
}


module.exports = {
  listReports,
  createReport,
  reviewReport
};