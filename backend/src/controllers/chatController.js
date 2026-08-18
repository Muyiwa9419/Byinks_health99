const { ChatThread, ChatMessage } = require('../models');
const { getIO } = require('../sockets');

async function getActiveThreads(req, res) {
  const { userId } = req.params;
  const threads = await ChatThread.findAll({ order: [['updatedAt', 'DESC']] });
  const mine = threads.filter((t) => t.participants.includes(userId));

  const withLastMessage = await Promise.all(mine.map(async (t) => {
    const lastMessage = await ChatMessage.findOne({
      where: { chatId: t.chatId },
      order: [['timestamp', 'DESC']],
    });
    return { chatId: t.chatId, participants: t.participants, updatedAt: t.updatedAt, lastMessage };
  }));

  res.json(withLastMessage);
}

async function getMessages(req, res) {
  const messages = await ChatMessage.findAll({
    where: { chatId: req.params.chatId },
    order: [['timestamp', 'ASC']],
  });
  res.json(messages);
}

// Persist a message + upsert thread, then broadcast over socket.io to anyone
// subscribed to this chat room (replaces the old Supabase broadcast channel).
async function postMessage(req, res) {
  const { chatId } = req.params;
  const { text, isSystem } = req.body;

const senderId = req.user.id;
const senderName = req.user.name;

  const message = await ChatMessage.create({
    chatId,
    senderId,
    senderName,
    text,
    time: new Date().toLocaleTimeString(),
    timestamp: Date.now(),
    isSystem: !!isSystem,
  });

  const participants = chatId.split('--');
  await ChatThread.upsert({ chatId, participants, updatedAt: new Date() });

  const io = getIO();
  if (io) io.to(`chat:${chatId}`).emit('chat:message', message);

  res.status(201).json(message);
}

async function endSession(req, res) {
  const { chatId } = req.params;
  await ChatThread.destroy({ where: { chatId } });

  const io = getIO();
  if (io) io.to(`chat:${chatId}`).emit('chat:ended', { chatId, timestamp: Date.now() });

  res.json({ success: true });
}

module.exports = { getActiveThreads, getMessages, postMessage, endSession };
