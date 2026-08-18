const { Prescription, DeliveryOrder } = require('../models');

async function listPrescriptions(req, res) {
  const { patientId, consultantId, pharmacyId, status } = req.query;
  const where = {};
  if (patientId) where.patientId = patientId;
  if (consultantId) where.consultantId = consultantId;
  if (pharmacyId) where.pharmacyId = pharmacyId;
  if (status) where.status = status;
  const prescriptions = await Prescription.findAll({ where, order: [['createdAt', 'DESC']] });
  res.json(prescriptions);
}

async function createPrescription(req, res) {
  const prescription = await Prescription.create(req.body);
  res.status(201).json(prescription);
}

async function updatePrescriptionStatus(req, res) {
  const { status, pharmacyId } = req.body;
  const prescription = await Prescription.findByPk(req.params.id);
  if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

  const updates = {};
  if (status) updates.status = status;
  if (pharmacyId) updates.pharmacyId = pharmacyId;
  await prescription.update(updates);

  // When a pharmacy marks a prescription ready for dispatch, auto-create the delivery order
  if (status === 'ready_for_dispatch') {
    const existing = await DeliveryOrder.findOne({ where: { prescriptionId: prescription.id } });
    if (!existing) {
      await DeliveryOrder.create({
        prescriptionId: prescription.id,
        patientId: prescription.patientId,
        patientName: prescription.patientName,
        medications: prescription.medications,
        dosage: prescription.dosage,
        pharmacyId: prescription.pharmacyId,
        status: 'pending',
        patientAddress: req.body.patientAddress || 'Address not provided',
        timestamp: new Date().toISOString(),
      });
    }
  }

  res.json(prescription);
}

module.exports = { listPrescriptions, createPrescription, updatePrescriptionStatus };
