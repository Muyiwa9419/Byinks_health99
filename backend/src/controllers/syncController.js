const { SyncRequest } = require('../models');

async function listSyncRequests(req, res) {
  const requests = await SyncRequest.findAll({ order: [['createdAt', 'DESC']] });
  res.json(requests);
}

async function createSyncRequest(req, res) {
  const { requesterEmail, deviceInfo } = req.body;
  const request = await SyncRequest.create({
    requesterEmail, deviceInfo, timestamp: new Date().toISOString(),
  });
  res.status(201).json(request);
}

async function updateSyncRequestStatus(req, res) {
  const { status } = req.body; // 'approved' | 'rejected'
  const request = await SyncRequest.findByPk(req.params.id);
  if (!request) return res.status(404).json({ error: 'Sync request not found' });
  request.status = status;
  await request.save();
  res.json(request);
}

module.exports = { listSyncRequests, createSyncRequest, updateSyncRequestStatus };
