const {
  Prescription,
  DeliveryOrder,
} = require('../models');

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
     * Role-based filtering.
     *
     * Pharmacy users should see prescriptions assigned
     * to them, or prescriptions that are waiting for
     * pharmacy processing.
     */
    if (req.user.role === 'PHARMACY') {
      where.pharmacyId = req.user.id;
    }

    /*
     * Patients can only see their own prescriptions.
     */
    if (req.user.role === 'PATIENT') {
      where.patientId = req.user.id;
    }

    /*
     * Consultants can see prescriptions they created.
     */
    if (req.user.role === 'CONSULTANT') {
      where.consultantId = req.user.id;
    }

    /*
     * Admin can query freely.
     */
    if (req.user.role === 'ADMIN') {
      if (patientId) {
        where.patientId = patientId;
      }

      if (consultantId) {
        where.consultantId = consultantId;
      }

      if (pharmacyId) {
        where.pharmacyId = pharmacyId;
      }
    }

    /*
     * Status can be used by all authorized roles.
     */
    if (status) {
      where.status = status;
    }

    const prescriptions =
      await Prescription.findAll({
        where,
        order: [
          ['createdAt', 'DESC'],
        ],
      });

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
     * Only consultants should create prescriptions.
     */
    if (
      req.user.role !== 'CONSULTANT' &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        error:
          'Only consultants can create prescriptions',
      });
    }

    const prescriptionData = {
      ...req.body,

      /*
       * Always use the authenticated consultant ID
       * rather than trusting the browser.
       */
      consultantId:
        req.user.role === 'CONSULTANT'
          ? req.user.id
          : req.body.consultantId,

      /*
       * New prescriptions must start in a pharmacy
       * waiting state.
       */
      status:
        req.body.status ||
        'pending_pharmacy',
    };

    const prescription =
      await Prescription.create(
        prescriptionData
      );

    console.log(
      'PRESCRIPTION CREATED:',
      {
        id: prescription.id,
        patientId:
          prescription.patientId,
        consultantId:
          prescription.consultantId,
        status:
          prescription.status,
      }
    );

    return res.status(201).json(
      prescription
    );
  } catch (error) {
    console.error(
      'Create prescription error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to create prescription',
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
        error:
          'Prescription not found',
      });
    }

    /*
     * -----------------------------------------------------
     * PHARMACY ACTIONS
     * -----------------------------------------------------
     */

    if (req.user.role === 'PHARMACY') {
      /*
       * Pharmacy can only update prescriptions
       * assigned to them OR claim an unassigned
       * prescription.
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
      updates.pharmacyId =
        req.user.id;
    } else if (pharmacyId) {
      updates.pharmacyId =
        pharmacyId;
    }

    await prescription.update(
      updates
    );


    /**
     * -----------------------------------------------------
     * PHARMACY CONFIRMS MEDICATION AVAILABLE
     * -----------------------------------------------------
     *
     * The expected status is:
     *
     * available
     *
     * Then the pharmacy can move it to:
     *
     * ready_for_dispatch
     */
    if (
      status ===
      'ready_for_dispatch'
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
       * Broadcast to Socket.IO if available.
       *
       * This does NOT replace PostgreSQL.
       * PostgreSQL remains the source of truth.
       */
      const io =
        req.app.get('io');

      if (io) {
        io.emit(
          'delivery:new',
          deliveryOrder
        );

        /*
         * Also notify pharmacy/dispatch clients
         * that prescription processing changed.
         */
        io.emit(
          'prescription:updated',
          prescription
        );
      }
    }


    /**
     * -----------------------------------------------------
     * GENERAL PRESCRIPTION BROADCAST
     * -----------------------------------------------------
     */

    const io =
      req.app.get('io');

    if (io) {
      io.emit(
        'prescription:updated',
        prescription
      );
    }

    return res.json(
      prescription
    );
  } catch (error) {
    console.error(
      'Update prescription status error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to update prescription',
      message: error.message,
    });
  }
}


module.exports = {
  listPrescriptions,
  createPrescription,
  updatePrescriptionStatus,
};