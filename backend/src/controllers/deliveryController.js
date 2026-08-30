const { DeliveryOrder } = require('../models');
const { Op } = require('sequelize');
const { getIO } = require('../sockets');

/**
 * ---------------------------------------------------------
 * VALID DELIVERY STATUSES
 * ---------------------------------------------------------
 */

const DELIVERY_STATUSES = [
  'pending',
  'assigned',
  'in_transit',
  'delivered',
];

/**
 * ---------------------------------------------------------
 * LIST DELIVERIES
 * ---------------------------------------------------------
 *
 * Supports:
 *
 * GET /api/deliveries
 * GET /api/deliveries?patientId=...
 * GET /api/deliveries?pharmacyId=...
 * GET /api/deliveries?dispatchId=...
 * GET /api/deliveries?status=pending
 *
 * Dispatch users automatically receive only active deliveries
 * when no specific status was requested.
 */
async function listDeliveries(req, res) {
  try {
    const {
      patientId,
      pharmacyId,
      dispatchId,
      status,
    } = req.query;

    const where = {};

    /**
     * -----------------------------------------------------
     * FILTERS
     * -----------------------------------------------------
     */

    if (patientId) {
      where.patientId = patientId;
    }

    if (pharmacyId) {
      where.pharmacyId = pharmacyId;
    }

    if (dispatchId) {
      where.dispatchId = dispatchId;
    }

    /**
     * -----------------------------------------------------
     * STATUS FILTER
     * -----------------------------------------------------
     */

    if (status) {
      if (!DELIVERY_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `Invalid delivery status: ${status}`,
        });
      }

      where.status = status;
    }

    /**
     * -----------------------------------------------------
     * DISPATCH QUEUE
     * -----------------------------------------------------
     *
     * If a dispatch user requests deliveries without
     * specifying a status, return active delivery jobs.
     *
     * pending:
     *   Available for dispatch assignment
     *
     * assigned:
     *   Assigned to a dispatch rider
     *
     * in_transit:
     *   Currently being delivered
     */

    if (
      req.user &&
      req.user.role === 'DISPATCH' &&
      !status
    ) {
      where.status = {
        [Op.in]: [
          'pending',
          'assigned',
          'in_transit',
        ],
      };
    }

    /**
     * -----------------------------------------------------
     * FETCH
     * -----------------------------------------------------
     */

    const deliveries =
      await DeliveryOrder.findAll({
        where,
        order: [
          ['createdAt', 'DESC'],
        ],
      });

    /**
     * -----------------------------------------------------
     * RESPONSE
     * -----------------------------------------------------
     */

    res.json(
      deliveries.map((delivery) =>
        delivery.toPublicJSON()
      )
    );
  } catch (error) {
    console.error(
      'List deliveries error:',
      error
    );

    res.status(500).json({
      error: 'Failed to load deliveries',
      message: error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * CREATE DELIVERY
 * ---------------------------------------------------------
 *
 * Normally a delivery should be created automatically
 * when the pharmacy marks a prescription:
 *
 * ready_for_dispatch
 *
 * This endpoint is still kept for compatibility.
 */
async function createDelivery(req, res) {
  try {
    const {
      prescriptionId,
      patientId,
      patientName,
      medications,
      dosage,
      pharmacyId,
      dispatchId,
      patientAddress,
      patientLocation,
    } = req.body;

    /**
     * Required fields
     */

    if (
      !prescriptionId ||
      !patientId ||
      !patientName ||
      !medications ||
      !dosage ||
      !pharmacyId ||
      !patientAddress
    ) {
      return res.status(400).json({
        error:
          'Missing required delivery information',
      });
    }

    /**
     * Prevent duplicate deliveries for
     * the same prescription.
     */

    const existing =
      await DeliveryOrder.findOne({
        where: {
          prescriptionId,
        },
      });

    if (existing) {
      return res.status(409).json({
        error:
          'A delivery already exists for this prescription',
        delivery:
          existing.toPublicJSON(),
      });
    }

    /**
     * Create delivery.
     */

    const delivery =
      await DeliveryOrder.create({
        prescriptionId,
        patientId,
        patientName,
        medications,
        dosage,
        pharmacyId,
        dispatchId:
          dispatchId || null,
        status:
          dispatchId
            ? 'assigned'
            : 'pending',
        patientAddress,
        patientLocationLat:
          patientLocation?.lat ?? null,
        patientLocationLng:
          patientLocation?.lng ?? null,
        timestamp:
          new Date().toISOString(),
      });

    const publicDelivery =
      delivery.toPublicJSON();

    /**
     * -----------------------------------------------------
     * REAL-TIME BROADCAST
     * -----------------------------------------------------
     */

    const io = getIO();

    if (io) {
      /**
       * Notify pharmacy
       */
      io.emit(
        'delivery:created',
        publicDelivery
      );

      /**
       * Notify patient
       */
      io.to(
        `patient:${patientId}`
      ).emit(
        'delivery:created',
        publicDelivery
      );

      /**
       * Notify dispatch
       */
      io.emit(
        'dispatch:new_delivery',
        publicDelivery
      );
    }

    res.status(201).json(
      publicDelivery
    );
  } catch (error) {
    console.error(
      'Create delivery error:',
      error
    );

    res.status(500).json({
      error:
        'Failed to create delivery',
      message: error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * ASSIGN DISPATCH RIDER
 * ---------------------------------------------------------
 *
 * PATCH /api/deliveries/:id/assign
 *
 * Body:
 *
 * {
 *   "dispatchId": "..."
 * }
 */
async function assignDispatch(req, res) {
  try {
    const {
      dispatchId,
    } = req.body;

    if (!dispatchId) {
      return res.status(400).json({
        error:
          'Dispatch rider ID is required',
      });
    }

    const delivery =
      await DeliveryOrder.findByPk(
        req.params.id
      );

    if (!delivery) {
      return res.status(404).json({
        error:
          'Delivery not found',
      });
    }

    /**
     * Don't assign a completed delivery.
     */

    if (
      delivery.status ===
      'delivered'
    ) {
      return res.status(400).json({
        error:
          'A delivered order cannot be reassigned',
      });
    }

    /**
     * Assign rider.
     */

    await delivery.update({
      dispatchId,
      status: 'assigned',
    });

    const publicDelivery =
      delivery.toPublicJSON();

    /**
     * -----------------------------------------------------
     * SOCKET BROADCAST
     * -----------------------------------------------------
     */

    const io = getIO();

    if (io) {
      /**
       * Notify the assigned dispatch rider.
       */
      io.to(
        `dispatch:${dispatchId}`
      ).emit(
        'delivery:assigned',
        publicDelivery
      );

      /**
       * Notify patient.
       */
      io.to(
        `patient:${delivery.patientId}`
      ).emit(
        'delivery:status',
        publicDelivery
      );

      /**
       * Notify pharmacy.
       */
      io.to(
        `pharmacy:${delivery.pharmacyId}`
      ).emit(
        'delivery:status',
        publicDelivery
      );

      /**
       * Delivery-specific room.
       */
      io.to(
        `delivery:${delivery.id}`
      ).emit(
        'delivery:status',
        publicDelivery
      );
    }

    res.json(
      publicDelivery
    );
  } catch (error) {
    console.error(
      'Assign dispatch error:',
      error
    );

    res.status(500).json({
      error:
        'Failed to assign dispatch rider',
      message: error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * UPDATE DELIVERY STATUS
 * ---------------------------------------------------------
 *
 * PATCH /api/deliveries/:id/status
 *
 * Body:
 *
 * {
 *   "status": "in_transit"
 * }
 *
 * Valid:
 *
 * pending
 * assigned
 * in_transit
 * delivered
 */
async function updateDeliveryStatus(
  req,
  res
) {
  try {
    const {
      status,
    } = req.body;

    /**
     * Validate status.
     */

    if (
      !status ||
      !DELIVERY_STATUSES.includes(
        status
      )
    ) {
      return res.status(400).json({
        error:
          'Invalid delivery status',
        allowedStatuses:
          DELIVERY_STATUSES,
      });
    }

    /**
     * Find delivery.
     */

    const delivery =
      await DeliveryOrder.findByPk(
        req.params.id
      );

    if (!delivery) {
      return res.status(404).json({
        error:
          'Delivery not found',
      });
    }

    /**
     * Don't allow changes after delivery.
     */

    if (
      delivery.status ===
        'delivered' &&
      status !== 'delivered'
    ) {
      return res.status(400).json({
        error:
          'A delivered order cannot be moved back to another status',
      });
    }

    /**
     * Update.
     */

    await delivery.update({
      status,
      timestamp:
        new Date().toISOString(),
    });

    const publicDelivery =
      delivery.toPublicJSON();

    /**
     * -----------------------------------------------------
     * SOCKET BROADCAST
     * -----------------------------------------------------
     */

    const io = getIO();

    if (io) {
      /**
       * Everyone watching this delivery.
       */
      io.to(
        `delivery:${delivery.id}`
      ).emit(
        'delivery:status',
        publicDelivery
      );

      /**
       * Patient.
       */
      io.to(
        `patient:${delivery.patientId}`
      ).emit(
        'delivery:status',
        publicDelivery
      );

      /**
       * Pharmacy.
       */
      io.to(
        `pharmacy:${delivery.pharmacyId}`
      ).emit(
        'delivery:status',
        publicDelivery
      );

      /**
       * Dispatch rider.
       */
      if (
        delivery.dispatchId
      ) {
        io.to(
          `dispatch:${delivery.dispatchId}`
        ).emit(
          'delivery:status',
          publicDelivery
        );
      }
    }

    res.json(
      publicDelivery
    );
  } catch (error) {
    console.error(
      'Update delivery status error:',
      error
    );

    res.status(500).json({
      error:
        'Failed to update delivery status',
      message: error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * UPDATE DELIVERY LOCATION
 * ---------------------------------------------------------
 *
 * PATCH /api/deliveries/:id/location
 *
 * Body:
 *
 * {
 *   "lat": 6.5244,
 *   "lng": 3.3792
 * }
 */
async function updateLocation(
  req,
  res
) {
  try {
    const {
      lat,
      lng,
    } = req.body;

    /**
     * Validate coordinates.
     */

    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number'
    ) {
      return res.status(400).json({
        error:
          'Valid latitude and longitude are required',
      });
    }

    if (
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        error:
          'Invalid latitude or longitude',
      });
    }

    /**
     * Find delivery.
     */

    const delivery =
      await DeliveryOrder.findByPk(
        req.params.id
      );

    if (!delivery) {
      return res.status(404).json({
        error:
          'Delivery not found',
      });
    }

    /**
     * Update current location.
     */

    await delivery.update({
      currentLocationLat:
        lat,
      currentLocationLng:
        lng,
      timestamp:
        new Date().toISOString(),
    });

    const publicDelivery =
      delivery.toPublicJSON();

    /**
     * -----------------------------------------------------
     * REAL-TIME LOCATION BROADCAST
     * -----------------------------------------------------
     */

    const io = getIO();

    if (io) {
      const locationPayload = {
        deliveryId:
          delivery.id,
        lat,
        lng,
      };

      /**
       * Delivery-specific room.
       */
      io.to(
        `delivery:${delivery.id}`
      ).emit(
        'delivery:location',
        locationPayload
      );

      /**
       * Patient.
       */
      io.to(
        `patient:${delivery.patientId}`
      ).emit(
        'delivery:location',
        locationPayload
      );

      /**
       * Pharmacy.
       */
      io.to(
        `pharmacy:${delivery.pharmacyId}`
      ).emit(
        'delivery:location',
        locationPayload
      );
    }

    res.json(
      publicDelivery
    );
  } catch (error) {
    console.error(
      'Update delivery location error:',
      error
    );

    res.status(500).json({
      error:
        'Failed to update delivery location',
      message: error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * EXPORTS
 * ---------------------------------------------------------
 */

module.exports = {
  listDeliveries,
  createDelivery,
  assignDispatch,
  updateDeliveryStatus,
  updateLocation,
};