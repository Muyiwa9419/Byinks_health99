const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');

let io = null;

function initSockets(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
  });

  // Auth handshake: client passes JWT the same way it does for REST calls
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));
      const payload = verifyToken(token);
      socket.user = payload; // { sub, role, email }
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    // Personal room for direct notifications
    socket.join(`user:${socket.user.sub}`);

    // Client explicitly joins the chat rooms / delivery rooms it cares about,
    // mirroring the old subscribeToClinicalCloud(chatId) / delivery tracking behavior.
    socket.on('chat:join', (chatId) => socket.join(`chat:${chatId}`));
    socket.on('chat:leave', (chatId) => socket.leave(`chat:${chatId}`));

    socket.on('delivery:join', (deliveryId) => socket.join(`delivery:${deliveryId}`));
    socket.on('delivery:leave', (deliveryId) => socket.leave(`delivery:${deliveryId}`));

    // Global "system_relay" equivalent — broadcast arbitrary collection updates
    // to every connected client, matching the old ClinicalAPI system channel.
    socket.on('system:broadcast', (payload) => {
      socket.broadcast.emit('system:update', payload);
    });

    socket.on('disconnect', () => {
      // no-op placeholder: presence/online-status is managed via REST
      // (updateUserStatus) rather than socket disconnect, to avoid flapping
      // isOnline on brief reconnects.
    });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSockets, getIO };
