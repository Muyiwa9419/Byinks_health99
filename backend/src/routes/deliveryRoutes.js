const express = require('express');

const {
  listDeliveries,
  createDelivery,
  assignDispatch,
  updateDeliveryStatus,
  confirmDelivery,
  updateLocation,
} = require('../controllers/deliveryController');

const {
  requireAuth,
  requireRole,
} = require('../middleware/auth');

const router = express.Router();


/*
 * ---------------------------------------------------------
 * LIST
 * ---------------------------------------------------------
 */
router.get(
  '/',
  requireAuth,
  listDeliveries
);


/*
 * ---------------------------------------------------------
 * CREATE
 * ---------------------------------------------------------
 */
router.post(
  '/',
  requireAuth,
  requireRole('PHARMACY', 'ADMIN'),
  createDelivery
);


/*
 * ---------------------------------------------------------
 * ASSIGN DISPATCH
 * ---------------------------------------------------------
 */
router.patch(
  '/:id/assign',
  requireAuth,
  requireRole('DISPATCH', 'ADMIN'),
  assignDispatch
);


/*
 * ---------------------------------------------------------
 * UPDATE DELIVERY STATUS
 * ---------------------------------------------------------
 */
router.patch(
  '/:id/status',
  requireAuth,
  updateDeliveryStatus
);


/*
 * ---------------------------------------------------------
 * PATIENT CONFIRMS RECEIPT
 * ---------------------------------------------------------
 */
router.patch(
  '/:id/confirm',
  requireAuth,
  requireRole('PATIENT'),
  confirmDelivery
);


/*
 * ---------------------------------------------------------
 * LIVE LOCATION
 * ---------------------------------------------------------
 */
router.patch(
  '/:id/location',
  requireAuth,
  requireRole('DISPATCH'),
  updateLocation
);


module.exports = router;