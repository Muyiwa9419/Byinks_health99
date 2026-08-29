const { MedicalReport, Appointment } = require('../models');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

// =====================================================
// GET /api/reports
// =====================================================
async function listReports(req, res) {
  try {
    const { patientId, status } = req.query;

    const where = {};

    // ===================================================
    // PATIENT
    // ===================================================
    if (req.user.role === 'PATIENT') {
      where.patientId = req.user.id;
    }

    // ===================================================
    // CONSULTANT
    // ===================================================
    else if (req.user.role === 'CONSULTANT') {
      const appointments = await Appointment.findAll({
        where: {
          consultantId: req.user.id,
        },
        attributes: ['patientId'],
        raw: true,
      });

      const patientIds = [
        ...new Set(
          appointments
            .map((appointment) => appointment.patientId)
            .filter(Boolean)
        ),
      ];

      if (patientIds.length === 0) {
        return res.json([]);
      }

      // Consultant requested one specific patient
      if (patientId) {
        if (!patientIds.includes(patientId)) {
          return res.status(403).json({
            error:
              'You are not authorized to view this patient reports',
          });
        }

        where.patientId = patientId;
      } else {
        // Return reports belonging to all consultant patients
        where.patientId = patientIds;
      }
    }

    // ===================================================
    // ADMIN
    // ===================================================
    else if (req.user.role === 'ADMIN') {
      if (patientId) {
        where.patientId = patientId;
      }
    }

    // ===================================================
    // OTHER ROLES
    // ===================================================
    else {
      return res.status(403).json({
        error:
          'You are not authorized to view medical reports',
      });
    }

    // ===================================================
    // STATUS FILTER
    // ===================================================
    if (status) {
      where.status = status;
    }

    const reports = await MedicalReport.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    return res.json(reports);
  } catch (error) {
    console.error('List reports error:', error);

    return res.status(500).json({
      error: 'Failed to fetch reports',
      message: error.message,
    });
  }
}

// =====================================================
// POST /api/reports
// =====================================================
async function createReport(req, res) {
  try {
    let patientId = req.body.patientId;

    // Patients can only create reports for themselves
    if (req.user.role === 'PATIENT') {
      patientId = req.user.id;
    }

    if (!patientId) {
      return res.status(400).json({
        error: 'Patient ID is required',
      });
    }

    const report = await MedicalReport.create({
      ...req.body,
      patientId,
      status: req.body.status || 'pending_review',
    });

    return res.status(201).json(report);
  } catch (error) {
    console.error('Create report error:', error);

    return res.status(500).json({
      error: 'Failed to create report',
      message: error.message,
    });
  }
}

// =====================================================
// POST /api/reports/upload
// =====================================================

// async function uploadReport(req, res) {
//   try {
//     if (req.user.role !== 'PATIENT') {
//       return res.status(403).json({
//         error:
//           'Only patients can upload medical reports',
//       });
//     }

//     if (!req.file) {
//       return res.status(400).json({
//         error: 'Medical report file is required',
//       });
//     }

//     const patientId = req.user.id;

//     const patientName =
//       req.body.patientName ||
//       req.user.name ||
//       'Patient';

//     /*
//      * Upload the actual file to Cloudinary.
//      *
//      * resource_type: 'auto' lets Cloudinary handle
//      * PDFs/images correctly.
//      */
//     const uploadResult = await new Promise(
//       (resolve, reject) => {
//         const stream =
//           cloudinary.uploader.upload_stream(
//             {
//               folder: `byinks-health/medical-reports/${patientId}`,

//               resource_type: 'auto',

//               use_filename: true,

//               unique_filename: true,

//               overwrite: false,
//             },
//             (error, result) => {
//               if (error) {
//                 return reject(error);
//               }

//               resolve(result);
//             }
//           );

//         Readable.from(
//           req.file.buffer
//         ).pipe(stream);
//       }
//     );

//     if (!uploadResult?.secure_url) {
//       return res.status(500).json({
//         error:
//           'Cloud storage did not return a report URL',
//       });
//     }

//     /*
//      * Save the permanent Cloudinary URL
//      * into PostgreSQL.
//      */
//     const report =
//       await MedicalReport.create({
//         patientId,

//         patientName,

//         fileName:
//           req.file.originalname,

//         fileUrl:
//           uploadResult.secure_url,

//         uploadDate:
//           new Date().toLocaleDateString(),

//         status:
//           'pending_review',
//       });

//     console.log(
//       'MEDICAL REPORT UPLOADED:',
//       {
//         id: report.id,
//         patientId: report.patientId,
//         fileName: report.fileName,
//         fileUrl: report.fileUrl,
//       }
//     );

//     return res.status(201).json(report);
//   } catch (error) {
//     console.error(
//       'Upload medical report error:',
//       error
//     );

//     return res.status(500).json({
//       error:
//         'Failed to upload medical report',
//       message: error.message,
//     });
//   }
// }

async function uploadReport(req, res) {
  try {
    console.log('=================================');
    console.log('MEDICAL REPORT UPLOAD STARTED');
    console.log('=================================');

    console.log('User:', req.user?.id);
    console.log('Role:', req.user?.role);

    console.log('File received:', {
      exists: !!req.file,
      originalname: req.file?.originalname,
      mimetype: req.file?.mimetype,
      size: req.file?.size,
    });

    console.log('Cloudinary config:', {
      cloud_name:
        process.env.CLOUDINARY_CLOUD_NAME
          ? 'PRESENT'
          : 'MISSING',

      api_key:
        process.env.CLOUDINARY_API_KEY
          ? 'PRESENT'
          : 'MISSING',

      api_secret:
        process.env.CLOUDINARY_API_SECRET
          ? 'PRESENT'
          : 'MISSING',
    });

    if (req.user.role !== 'PATIENT') {
      return res.status(403).json({
        error:
          'Only patients can upload medical reports',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error:
          'Medical report file is required',
      });
    }

    const patientId = req.user.id;

    const patientName =
      req.body.patientName ||
      req.user.name ||
      'Patient';

    console.log(
      'Starting Cloudinary upload...'
    );

    const uploadResult =
      await new Promise(
        (resolve, reject) => {

          const stream =
            cloudinary.uploader.upload_stream(
              {
                folder:
                  `byinks-health/medical-reports/${patientId}`,

                resource_type: 'auto',

                use_filename: true,

                unique_filename: true,

                overwrite: false,
              },

              (error, result) => {

                if (error) {
                  console.error(
                    'CLOUDINARY ERROR:',
                    error
                  );

                  return reject(error);
                }

                console.log(
                  'CLOUDINARY SUCCESS:',
                  {
                    public_id:
                      result?.public_id,

                    secure_url:
                      result?.secure_url,

                    resource_type:
                      result?.resource_type,
                  }
                );

                resolve(result);
              }
            );

          stream.on(
            'error',
            (error) => {
              console.error(
                'CLOUDINARY STREAM ERROR:',
                error
              );

              reject(error);
            }
          );

          Readable
            .from(req.file.buffer)
            .pipe(stream);
        }
      );

    if (!uploadResult?.secure_url) {
      return res.status(500).json({
        error:
          'Cloudinary did not return a secure URL',
      });
    }

    console.log(
      'Saving report to PostgreSQL...'
    );

    const report =
      await MedicalReport.create({
        patientId,

        patientName,

        fileName:
          req.file.originalname,

        fileUrl:
          uploadResult.secure_url,

        uploadDate:
          new Date().toLocaleDateString(),

        status:
          'pending_review',
      });

    console.log(
      'MEDICAL REPORT SAVED:',
      {
        id: report.id,
        fileName: report.fileName,
        fileUrl: report.fileUrl,
      }
    );

    return res.status(201).json(report);

  } catch (error) {

    console.error(
      '================================='
    );

    console.error(
      'UPLOAD MEDICAL REPORT ERROR'
    );

    console.error(
      error
    );

    console.error(
      '================================='
    );

    return res.status(500).json({
      error:
        'Failed to upload medical report',

      message:
        error.message,
    });
  }
}
// =====================================================
// GET /api/reports/:id/file
// =====================================================
async function getReportFile(req, res) {
  try {
    const report = await MedicalReport.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
      });
    }

    // ===================================================
    // PATIENT ACCESS
    // ===================================================
    if (req.user.role === 'PATIENT') {
      if (report.patientId !== req.user.id) {
        return res.status(403).json({
          error: 'You are not authorized to access this report',
        });
      }
    }

    // ===================================================
    // CONSULTANT ACCESS
    // ===================================================
    else if (req.user.role === 'CONSULTANT') {
      const appointment = await Appointment.findOne({
        where: {
          consultantId: req.user.id,
          patientId: report.patientId,
        },
      });

      if (!appointment) {
        return res.status(403).json({
          error:
            'You are not authorized to access this patient report',
        });
      }
    }

    // ===================================================
    // ADMIN ACCESS
    // ===================================================
    else if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error:
          'You are not authorized to access medical reports',
      });
    }

    // ===================================================
    // FILE CHECK
    // ===================================================
    if (!report.fileUrl) {
      return res.status(404).json({
        error: 'This report does not have an attached file',
      });
    }

    // ===================================================
    // RETURN FILE INFORMATION
    // ===================================================
    return res.json({
      id: report.id,
      patientId: report.patientId,
      patientName: report.patientName,
      fileName: report.fileName,
      fileUrl: report.fileUrl,
      uploadDate: report.uploadDate,
      status: report.status,
    });
  } catch (error) {
    console.error(
      'Get report file error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to retrieve medical report',
      message: error.message,
    });
  }
}

// =====================================================
// PATCH /api/reports/:id/review
// =====================================================
async function reviewReport(req, res) {
  try {
    const {
      status,
      consultantNote,
    } = req.body;

    // ===================================================
    // FIND REPORT
    // ===================================================
    const report = await MedicalReport.findByPk(
      req.params.id
    );

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
      });
    }

    // ===================================================
    // CONSULTANT AUTHORIZATION
    // ===================================================
    if (req.user.role === 'CONSULTANT') {
      const appointment = await Appointment.findOne({
        where: {
          consultantId: req.user.id,
          patientId: report.patientId,
        },
      });

      if (!appointment) {
        return res.status(403).json({
          error:
            'You are not authorized to review this report',
        });
      }
    }

    // ===================================================
    // VALID STATUSES
    // ===================================================
    const allowedStatuses = [
      'pending_review',
      'vetted',
      'rejected',
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid report status',
      });
    }

    // ===================================================
    // UPDATE REPORT
    // ===================================================
    await report.update({
      status,
      consultantNote: consultantNote || null,
      vettedBy: req.user.id,
    });

    return res.json(report);
  } catch (error) {
    console.error('Review report error:', error);

    return res.status(500).json({
      error: 'Failed to review report',
      message: error.message,
    });
  }
}

// =====================================================
// EXPORTS
// =====================================================
module.exports = {
  listReports,
  createReport,
  uploadReport,
  getReportFile,
  reviewReport,
};

