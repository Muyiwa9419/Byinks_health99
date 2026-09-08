const {
  Prescription,
  DeliveryOrder,
} = require('../models');

const { Op } = require('sequelize');

/**
 * ---------------------------------------------------------
 * LIST PRESCRIPTIONS
 * ---------------------------------------------------------
 */
async function listPrescriptions(req, res) {
  try {
    const {
      patientId,
      consultantId,
      pharmacyId,
      status,
    } = req.query;

    const where = {};

    /*
     * ---------------------------------------------------------
     * PHARMACY
     * ---------------------------------------------------------
     *
     * A pharmacy must see:
     *
     * 1. New prescriptions sent to pharmacy that have
     *    not yet been claimed by a pharmacy.
     *
     * 2. Prescriptions already claimed by this pharmacy.
     */
    if (req.user.role === 'PHARMACY') {
      where[Op.or] = [
        {
          pharmacyId: null,
          status: 'sent_to_pharmacy',
        },
        {
          pharmacyId: req.user.id,
        },
      ];
    }

    /*
     * ---------------------------------------------------------
     * PATIENT
     * ---------------------------------------------------------
     */
    else if (req.user.role === 'PATIENT') {
      where.patientId = req.user.id;
    }

    /*
     * ---------------------------------------------------------
     * CONSULTANT
     * ---------------------------------------------------------
     */
    else if (req.user.role === 'CONSULTANT') {
      where.consultantId = req.user.id;
    }

    /*
     * ---------------------------------------------------------
     * ADMIN
     * ---------------------------------------------------------
     */
    else if (req.user.role === 'ADMIN') {
      if (patientId) {
        where.patientId = patientId;
      }

      if (consultantId) {
        where.consultantId = consultantId;
      }

      if (pharmacyId) {
        where.pharmacyId = pharmacyId;
      }

      if (status) {
        where.status = status;
      }
    }

    /*
     * ---------------------------------------------------------
     * OPTIONAL STATUS FILTER
     * ---------------------------------------------------------
     *
     * Do not apply this blindly to PHARMACY because the
     * pharmacy query already has a controlled OR condition.
     */
    if (
      status &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'PHARMACY'
    ) {
      where.status = status;
    }

    const prescriptions = await Prescription.findAll({
      where,
      order: [
        ['createdAt', 'DESC'],
      ],
    });

    console.log(
      '[PRESCRIPTIONS] User:',
      {
        id: req.user.id,
        role: req.user.role,
      }
    );

    console.log(
      '[PRESCRIPTIONS] Query:',
      req.query
    );

    console.log(
      '[PRESCRIPTIONS] Returning:',
      prescriptions.length
    );

    if (req.user.role === 'PHARMACY') {
      console.log(
        '[PHARMACY] Prescriptions:',
        prescriptions.map((p) => ({
          id: p.id,
          patientId: p.patientId,
          patientName: p.patientName,
          consultantId: p.consultantId,
          status: p.status,
          pharmacyId: p.pharmacyId,
        }))
      );
    }

    return res.json(prescriptions);

  } catch (error) {
    console.error(
      'List prescriptions error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to load prescriptions',
      message: error.message,
    });
  }
}


/**
 * ---------------------------------------------------------
 * CREATE PRESCRIPTION
 * ---------------------------------------------------------
 */
async function createPrescription(req, res) {
  try {
    /*
     * Only consultants and admins should create prescriptions.
     */
    if (
      req.user.role !== 'CONSULTANT' &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        error: 'Only consultants can create prescriptions',
      });
    }

    /*
     * Build prescription data.
     *
     * Consultants cannot impersonate another consultant.
     * Their authenticated account becomes the consultant.
     */
    const prescriptionData = {
      ...req.body,

      consultantId:
        req.user.role === 'CONSULTANT'
          ? req.user.id
          : req.body.consultantId,

      consultantName:
        req.user.role === 'CONSULTANT'
          ? req.user.name
          : req.body.consultantName,

      date:
        req.body.date ||
        new Date().toLocaleDateString(),

      status:
        req.body.status ||
        'sent_to_pharmacy',

      /*
       * A newly created prescription is not yet assigned
       * to a pharmacy.
       */
      pharmacyId: null,
    };

    /*
     * Required fields.
     */
    if (
      !prescriptionData.patientId ||
      !prescriptionData.patientName ||
      !prescriptionData.medications ||
      !prescriptionData.dosage
    ) {
      return res.status(400).json({
        error:
          'patientId, patientName, medications and dosage are required',
      });
    }

    const prescription =
      await Prescription.create(
        prescriptionData
      );

    console.log(
      'PRESCRIPTION CREATED:',
      {
        id: prescription.id,
        patientId: prescription.patientId,
        consultantId: prescription.consultantId,
        pharmacyId: prescription.pharmacyId,
        status: prescription.status,
      }
    );

    /*
     * Notify connected clients if Socket.IO is available.
     *
     * PostgreSQL remains the source of truth.
     */
    const io = req.app.get('io');

    if (io) {
      io.emit(
        'prescription:created',
        prescription
      );
    }

    return res.status(201).json(
      prescription
    );

  } catch (error) {
    console.error(
      'Create prescription error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to create prescription',
      message: error.message,
    });
  }
}


/**
 * ---------------------------------------------------------
 * UPDATE PRESCRIPTION STATUS
 * ---------------------------------------------------------
 */
async function updatePrescriptionStatus(
  req,
  res
) {
  try {
    const {
      status,
      pharmacyId,
      patientAddress,
    } = req.body;

    const prescription =
      await Prescription.findByPk(
        req.params.id
      );

    if (!prescription) {
      return res.status(404).json({
        error: 'Prescription not found',
      });
    }

    /*
     * -----------------------------------------------------
     * PHARMACY ACTIONS
     * -----------------------------------------------------
     */
    if (req.user.role === 'PHARMACY') {

      /*
       * Pharmacy can update prescriptions assigned
       * to them OR claim an unassigned prescription.
       */
      if (
        prescription.pharmacyId &&
        prescription.pharmacyId !== req.user.id
      ) {
        return res.status(403).json({
          error:
            'This prescription belongs to another pharmacy',
        });
      }
    }

    /*
     * -----------------------------------------------------
     * PATIENT ACTIONS
     * -----------------------------------------------------
     */
    if (req.user.role === 'PATIENT') {
      if (
        prescription.patientId !==
        req.user.id
      ) {
        return res.status(403).json({
          error:
            'You cannot update another patient prescription',
        });
      }
    }

    /*
     * -----------------------------------------------------
     * VALID STATUSES
     * -----------------------------------------------------
     */
    const validStatuses = [
      'draft',
      'sent_to_pharmacy',
      'preparing',
      'ready_for_dispatch',
      'dispatched',
      'delivered',
    ];

    if (
      status &&
      !validStatuses.includes(status)
    ) {
      return res.status(400).json({
        error: 'Invalid prescription status',
        validStatuses,
      });
    }

    /*
     * -----------------------------------------------------
     * BUILD UPDATE
     * -----------------------------------------------------
     */
    const updates = {};

    if (status) {
      updates.status = status;
    }

    /*
     * Never allow the frontend to assign a random
     * pharmacy while the user is a pharmacy account.
     */
    if (req.user.role === 'PHARMACY') {
      updates.pharmacyId = req.user.id;
    } else if (pharmacyId) {
      updates.pharmacyId = pharmacyId;
    }

    await prescription.update(
      updates
    );

    /*
     * -----------------------------------------------------
     * PHARMACY READY FOR DISPATCH
     * -----------------------------------------------------
     *
     * When the pharmacy marks a prescription as
     * ready_for_dispatch, create a delivery order.
     */
    if (
      status === 'ready_for_dispatch'
    ) {

      /*
       * Make sure a pharmacy has actually
       * been assigned.
       */
      if (
        !prescription.pharmacyId
      ) {
        return res.status(400).json({
          error:
            'A pharmacy must be assigned before dispatch',
        });
      }

      /*
       * Prevent duplicate delivery orders.
       */
      let deliveryOrder =
        await DeliveryOrder.findOne({
          where: {
            prescriptionId:
              prescription.id,
          },
        });

      /*
       * Create delivery order only once.
       */
      if (!deliveryOrder) {
        deliveryOrder =
          await DeliveryOrder.create({
            prescriptionId:
              prescription.id,

            patientId:
              prescription.patientId,

            patientName:
              prescription.patientName,

            medications:
              prescription.medications,

            dosage:
              prescription.dosage,

            pharmacyId:
              prescription.pharmacyId,

            status:
              'pending',

            patientAddress:
              patientAddress ||
              'Address not provided',

            timestamp:
              new Date().toISOString(),
          });

        console.log(
          'DELIVERY ORDER CREATED:',
          {
            id:
              deliveryOrder.id,

            prescriptionId:
              deliveryOrder.prescriptionId,

            patientId:
              deliveryOrder.patientId,

            pharmacyId:
              deliveryOrder.pharmacyId,

            status:
              deliveryOrder.status,
          }
        );
      }

      /*
       * Broadcast delivery/prescription update
       * if Socket.IO is available.
       */
      const io = req.app.get('io');

      if (io) {
        io.emit(
          'prescription:ready_for_dispatch',
          prescription
        );

        io.emit(
          'delivery:created',
          deliveryOrder
        );
      }
    }

    /*
     * -----------------------------------------------------
     * GENERAL PRESCRIPTION BROADCAST
     * -----------------------------------------------------
     */
    const io = req.app.get('io');

    if (io) {
      io.emit(
        'prescription:updated',
        prescription
      );
    }

    /*
     * Reload so the response contains the latest
     * database values.
     */
    await prescription.reload();

    return res.json(
      prescription
    );

  } catch (error) {
    console.error(
      'Update prescription status error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to update prescription',
      message: error.message,
    });
  }
}


module.exports = {
  listPrescriptions,
  createPrescription,
  updatePrescriptionStatus,
};