const { Notification } = require('../models');
const { getIO } = require('../sockets');

async function listNotifications(req, res) {
  const notifs = await Notification.findAll({
    where: { userId: req.params.userId },
    order: [['createdAt', 'DESC']],
  });
  res.json(notifs);
}

async function createNotification(req, res) {
  const { userId, title, message, type } = req.body;
  const notif = await Notification.create({
    userId,
    title,
    message,
    type: type || 'system',
    timestamp: new Date().toISOString(),
  });

  const io = getIO();
  if (io) io.to(`user:${userId}`).emit('notification:new', notif);

  res.status(201).json(notif);
}

async function markRead(req, res) {
  const notif = await Notification.findByPk(req.params.id);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  notif.isRead = true;
  await notif.save();
  res.json(notif);
}

module.exports = { listNotifications, createNotification, markRead };
