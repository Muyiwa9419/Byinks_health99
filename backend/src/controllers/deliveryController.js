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
 * GET /api/deliveries
 *
 * Dispatch users receive:
 *
 * - pending deliveries
 * - deliveries assigned to them
 * - deliveries currently in transit assigned to them
 *
 * Other roles can use the normal filters.
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
     * PATIENT FILTER
     * -----------------------------------------------------
     */

    if (patientId) {
      where.patientId = patientId;
    }

    /**
     * -----------------------------------------------------
     * PHARMACY FILTER
     * -----------------------------------------------------
     */

    if (pharmacyId) {
      where.pharmacyId = pharmacyId;
    }

    /**
     * -----------------------------------------------------
     * DISPATCH FILTER
     * -----------------------------------------------------
     */

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
     * DISPATCH USER QUEUE
     * -----------------------------------------------------
     *
     * When a dispatcher loads the dashboard without a
     * specific status/filter:
     *
     * pending
     * assigned to this dispatcher
     * in_transit assigned to this dispatcher
     *
     * This prevents one dispatcher from seeing another
     * dispatcher's active deliveries.
     */

    if (
      req.user &&
      req.user.role === 'DISPATCH' &&
      !status &&
      !dispatchId
    ) {
      where[Op.or] = [
        {
          status: 'pending',
        },
        {
          dispatchId: req.user.id,
          status: {
            [Op.in]: [
              'assigned',
              'in_transit',
            ],
          },
        },
      ];
    }

    /**
     * -----------------------------------------------------
     * EXPLICIT DISPATCH ID
     * -----------------------------------------------------
     *
     * If a dispatcher explicitly asks for a dispatchId,
     * don't allow them to request another dispatcher's jobs.
     */

    if (
      req.user &&
      req.user.role === 'DISPATCH' &&
      dispatchId &&
      dispatchId !== req.user.id
    ) {
      return res.status(403).json({
        error:
          'You are not authorized to view another dispatcher deliveries',
      });
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

    return res.json(
      deliveries.map((delivery) =>
        delivery.toPublicJSON()
      )
    );
  } catch (error) {
    console.error(
      'List deliveries error:',
      error
    );

    return res.status(500).json({
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
 * Normally created automatically when pharmacy marks
 * prescription as ready_for_dispatch.
 */
async function createDelivery(req, res) {
  try {
    const {
      prescriptionId,
      patientId,
      patientName,
      patientPhone,
      medications,
      dosage,
      pharmacyId,
      dispatchId,
      patientAddress,
      patientLocation,
    } = req.body;

    /**
     * -----------------------------------------------------
     * REQUIRED FIELDS
     * -----------------------------------------------------
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
     * -----------------------------------------------------
     * DUPLICATE CHECK
     * -----------------------------------------------------
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
     * -----------------------------------------------------
     * CREATE DELIVERY
     * -----------------------------------------------------
     */

    const delivery =
      await DeliveryOrder.create({
        prescriptionId,

        patientId,

        patientName,

        patientPhone:
          patientPhone || null,

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
       * Notify pharmacy.
       */
      io.emit(
        'delivery:created',
        publicDelivery
      );

      /**
       * Notify patient.
       */
      io.to(
        `patient:${patientId}`
      ).emit(
        'delivery:created',
        publicDelivery
      );

      /**
       * Notify dispatch.
       */
      io.emit(
        'dispatch:new_delivery',
        publicDelivery
      );

      /**
       * If already assigned, notify that dispatcher
       * specifically.
       */
      if (dispatchId) {
        io.to(
          `dispatch:${dispatchId}`
        ).emit(
          'delivery:assigned',
          publicDelivery
        );
      }
    }

    return res.status(201).json(
      publicDelivery
    );
  } catch (error) {
    console.error(
      'Create delivery error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to create delivery',

      message:
        error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * ASSIGN DISPATCH RIDER
 * ---------------------------------------------------------
 *
 * PATCH /api/deliveries/:id/assign
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
     * Don't assign delivered orders.
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
       * Assigned dispatcher.
       */
      io.to(
        `dispatch:${dispatchId}`
      ).emit(
        'delivery:assigned',
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
       * Delivery room.
       */
      io.to(
        `delivery:${delivery.id}`
      ).emit(
        'delivery:status',
        publicDelivery
      );
    }

    return res.json(
      publicDelivery
    );
  } catch (error) {
    console.error(
      'Assign dispatch error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to assign dispatch rider',

      message:
        error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * UPDATE DELIVERY STATUS
 * ---------------------------------------------------------
 *
 * PATCH /api/deliveries/:id/status
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
     * Don't move delivered orders backwards.
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
     * Update status.
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
       * Delivery room.
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
       * Dispatcher.
       */
      if (delivery.dispatchId) {
        io.to(
          `dispatch:${delivery.dispatchId}`
        ).emit(
          'delivery:status',
          publicDelivery
        );
      }

      /**
       * General dispatch notification.
       */
      io.emit(
        'dispatch:delivery_updated',
        publicDelivery
      );
    }

    return res.json(
      publicDelivery
    );
  } catch (error) {
    console.error(
      'Update delivery status error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to update delivery status',

      message:
        error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * PATIENT CONFIRMS DELIVERY
 * ---------------------------------------------------------
 *
 * PATCH /api/deliveries/:id/confirm
 */
async function confirmDelivery(
  req,
  res
) {
  try {
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
     * Patient ownership check.
     */

    if (
      req.user &&
      req.user.role === 'PATIENT' &&
      delivery.patientId !== req.user.id
    ) {
      return res.status(403).json({
        error:
          'You are not authorized to confirm this delivery',
      });
    }

    /**
     * Must already be delivered.
     */

    if (
      delivery.status !==
      'delivered'
    ) {
      return res.status(400).json({
        error:
          'Delivery must be marked as delivered before confirmation',

        currentStatus:
          delivery.status,
      });
    }

    /**
     * Optional confirmation fields.
     */

    const updateFields = {};

    if (
      Object.prototype.hasOwnProperty.call(
        delivery.dataValues,
        'patientConfirmed'
      )
    ) {
      updateFields.patientConfirmed =
        true;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        delivery.dataValues,
        'confirmedAt'
      )
    ) {
      updateFields.confirmedAt =
        new Date().toISOString();
    }

    if (
      Object.keys(updateFields).length >
      0
    ) {
      await delivery.update(
        updateFields
      );
    }

    const publicDelivery =
      delivery.toPublicJSON();

    /**
     * -----------------------------------------------------
     * SOCKET BROADCAST
     * -----------------------------------------------------
     */

    const io = getIO();

    if (io) {
      io.to(
        `patient:${delivery.patientId}`
      ).emit(
        'delivery:confirmed',
        publicDelivery
      );

      io.to(
        `pharmacy:${delivery.pharmacyId}`
      ).emit(
        'delivery:confirmed',
        publicDelivery
      );

      if (delivery.dispatchId) {
        io.to(
          `dispatch:${delivery.dispatchId}`
        ).emit(
          'delivery:confirmed',
          publicDelivery
        );
      }

      io.to(
        `delivery:${delivery.id}`
      ).emit(
        'delivery:confirmed',
        publicDelivery
      );
    }

    return res.json({
      success: true,

      message:
        'Delivery receipt confirmed successfully',

      delivery:
        publicDelivery,
    });
  } catch (error) {
    console.error(
      'Confirm delivery error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to confirm delivery',

      message:
        error.message,
    });
  }
}

/**
 * ---------------------------------------------------------
 * UPDATE DELIVERY LOCATION
 * ---------------------------------------------------------
 *
 * PATCH /api/deliveries/:id/location
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
       * Delivery room.
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

      /**
       * Dispatcher.
       */
      if (delivery.dispatchId) {
        io.to(
          `dispatch:${delivery.dispatchId}`
        ).emit(
          'delivery:location',
          locationPayload
        );
      }
    }

    return res.json(
      publicDelivery
    );
  } catch (error) {
    console.error(
      'Update delivery location error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to update delivery location',

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
  listDeliveries,
  createDelivery,
  assignDispatch,
  updateDeliveryStatus,
  confirmDelivery,
  updateLocation,
};