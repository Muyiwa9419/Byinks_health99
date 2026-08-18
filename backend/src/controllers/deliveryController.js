const { DeliveryOrder } = require('../models');
const { getIO } = require('../sockets');

async function listDeliveries(req, res) {
  const { patientId, pharmacyId, dispatchId, status } = req.query;
  const where = {};
  if (patientId) where.patientId = patientId;
  if (pharmacyId) where.pharmacyId = pharmacyId;
  if (dispatchId) where.dispatchId = dispatchId;
  if (status) where.status = status;
  const deliveries = await DeliveryOrder.findAll({ where, order: [['createdAt', 'DESC']] });
  res.json(deliveries.map((d) => d.toPublicJSON()));
}

async function createDelivery(req, res) {
  const delivery = await DeliveryOrder.create(req.body);
  res.status(201).json(delivery.toPublicJSON());
}

async function assignDispatch(req, res) {
  const { dispatchId } = req.body;
  const delivery = await DeliveryOrder.findByPk(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  await delivery.update({ dispatchId, status: 'assigned' });
  res.json(delivery.toPublicJSON());
}

async function updateDeliveryStatus(req, res) {
  const { status } = req.body;
  const delivery = await DeliveryOrder.findByPk(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  await delivery.update({ status });
  res.json(delivery.toPublicJSON());
}

// Live map tracking: dispatch rider pushes location, we persist + broadcast over socket.io
// so patient/pharmacy dashboards watching this delivery update in real time.
async function updateLocation(req, res) {
  const { lat, lng } = req.body;
  const delivery = await DeliveryOrder.findByPk(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  await delivery.update({ currentLocationLat: lat, currentLocationLng: lng });

  const io = getIO();
  if (io) io.to(`delivery:${delivery.id}`).emit('delivery:location', { deliveryId: delivery.id, lat, lng });

  res.json(delivery.toPublicJSON());
}

module.exports = {
  listDeliveries, createDelivery, assignDispatch, updateDeliveryStatus, updateLocation,
};
