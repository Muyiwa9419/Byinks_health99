const express = require('express');
const {
  listDeliveries, createDelivery, assignDispatch, updateDeliveryStatus, updateLocation,
} = require('../controllers/deliveryController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listDeliveries);
router.post('/', requireAuth, createDelivery);
router.patch('/:id/assign', requireAuth, assignDispatch);
router.patch('/:id/status', requireAuth, updateDeliveryStatus);
router.patch('/:id/location', requireAuth, updateLocation);

module.exports = router;
