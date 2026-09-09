const {
  Prescription,
  DeliveryOrder,
  User,
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

    const prescriptions =
      await Prescription.findAll({
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

    return res.json(
      prescriptions
    );

  } catch (error) {
    console.error(
      'List prescriptions error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to load prescriptions',

      message:
        error.message,
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
        error:
          'Only consultants can create prescriptions',
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
        id:
          prescription.id,

        patientId:
          prescription.patientId,

        consultantId:
          prescription.consultantId,

        pharmacyId:
          prescription.pharmacyId,

        status:
          prescription.status,
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
      error:
        'Failed to create prescription',

      message:
        error.message,
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

    /*
     * -----------------------------------------------------
     * FIND PRESCRIPTION
     * -----------------------------------------------------
     */

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
    if (
      req.user.role === 'PHARMACY'
    ) {
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
    if (
      req.user.role === 'PATIENT'
    ) {
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
        error:
          'Invalid prescription status',

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
     * Never allow a pharmacy account to assign
     * the prescription to another pharmacy.
     */
    if (
      req.user.role === 'PHARMACY'
    ) {
      updates.pharmacyId =
        req.user.id;
    } else if (pharmacyId) {
      updates.pharmacyId =
        pharmacyId;
    }

    /*
     * Update prescription.
     */
    await prescription.update(
      updates
    );

    /*
     * -----------------------------------------------------
     * PHARMACY READY FOR DISPATCH
     * -----------------------------------------------------
     *
     * When pharmacy marks prescription as
     * ready_for_dispatch:
     *
     * 1. Find the patient.
     * 2. Get the patient's current contact details.
     * 3. Create the DeliveryOrder.
     *
     * The delivery stores a snapshot of the patient's
     * delivery information.
     */
    if (
      status === 'ready_for_dispatch'
    ) {

      /*
       * ---------------------------------------------------
       * MAKE SURE PHARMACY IS ASSIGNED
       * ---------------------------------------------------
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
       * ---------------------------------------------------
       * FIND PATIENT
       * ---------------------------------------------------
       *
       * We deliberately retrieve the patient from the
       * User table instead of trusting the frontend.
       *
       * This gives the dispatcher the actual:
       *
       * - name
       * - phone
       * - address
       * - latitude
       * - longitude
       */
      const patient =
        await User.findByPk(
          prescription.patientId
        );

      if (!patient) {
        return res.status(404).json({
          error:
            'Patient associated with this prescription was not found',
        });
      }

      /*
       * ---------------------------------------------------
       * PATIENT DELIVERY INFORMATION
       * ---------------------------------------------------
       */

      const resolvedPatientName =
        patient.name ||
        prescription.patientName;

      const resolvedPatientPhone =
        patient.phone ||
        null;

      /*
       * Prefer the patient's saved address.
       *
       * patientAddress from the request is retained as a
       * fallback so an existing workflow that sends an
       * address does not break.
       */
      const resolvedPatientAddress =
        patient.address ||
        patientAddress ||
        'Address not provided';

      /*
       * Patient coordinates.
       */
      const resolvedLatitude =
        patient.locationLat ??
        null;

      const resolvedLongitude =
        patient.locationLng ??
        null;

      /*
       * ---------------------------------------------------
       * PREVENT DUPLICATE DELIVERY
       * ---------------------------------------------------
       */

      let deliveryOrder =
        await DeliveryOrder.findOne({
          where: {
            prescriptionId:
              prescription.id,
          },
        });

      /*
       * ---------------------------------------------------
       * CREATE DELIVERY ORDER
       * ---------------------------------------------------
       */

      if (!deliveryOrder) {
        deliveryOrder =
          await DeliveryOrder.create({
            prescriptionId:
              prescription.id,

            patientId:
              prescription.patientId,

            patientName:
              resolvedPatientName,

            /*
             * NEW:
             * Patient phone number.
             */
            patientPhone:
              resolvedPatientPhone,

            medications:
              prescription.medications,

            dosage:
              prescription.dosage,

            pharmacyId:
              prescription.pharmacyId,

            /*
             * No dispatcher yet.
             */
            dispatchId:
              null,

            status:
              'pending',

            patientAddress:
              resolvedPatientAddress,

            patientLocationLat:
              resolvedLatitude,

            patientLocationLng:
              resolvedLongitude,

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

            patientName:
              deliveryOrder.patientName,

            patientPhone:
              deliveryOrder.patientPhone,

            patientAddress:
              deliveryOrder.patientAddress,

            pharmacyId:
              deliveryOrder.pharmacyId,

            status:
              deliveryOrder.status,
          }
        );
      } else {
        /*
         * -------------------------------------------------
         * UPDATE EXISTING DELIVERY DETAILS
         * -------------------------------------------------
         *
         * If a delivery somehow already exists, make sure
         * its patient contact information is up to date.
         */
        await deliveryOrder.update({
          patientName:
            resolvedPatientName,

          patientPhone:
            resolvedPatientPhone,

          patientAddress:
            resolvedPatientAddress,

          patientLocationLat:
            resolvedLatitude,

          patientLocationLng:
            resolvedLongitude,
        });
      }

      /*
       * ---------------------------------------------------
       * PUBLIC DELIVERY PAYLOAD
       * ---------------------------------------------------
       *
       * Always send the serialized delivery object.
       */
      const publicDelivery =
        deliveryOrder.toPublicJSON();

      /*
       * ---------------------------------------------------
       * SOCKET.IO
       * ---------------------------------------------------
       */

      const io =
        req.app.get('io');

      if (io) {

        /*
         * Notify pharmacy.
         */
        io.emit(
          'delivery:created',
          publicDelivery
        );

        /*
         * Notify dispatch dashboard.
         */
        io.emit(
          'dispatch:new_delivery',
          publicDelivery
        );

        /*
         * Notify patient.
         */
        io.to(
          `patient:${prescription.patientId}`
        ).emit(
          'delivery:created',
          publicDelivery
        );

        /*
         * Notify the prescription room/update.
         */
        io.emit(
          'prescription:ready_for_dispatch',
          prescription
        );
      }
    }

    /*
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

    /*
     * -----------------------------------------------------
     * RELOAD
     * -----------------------------------------------------
     *
     * Ensure response contains latest database values.
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
      error:
        'Failed to update prescription',

      message:
        error.message,
    });
  }
}


/**
 * ---------------------------------------------------------
 * EXPORTS
 * ---------------------------------------------------------
 */

module.exports = {
  listPrescriptions,
  createPrescription,
  updatePrescriptionStatus,
};