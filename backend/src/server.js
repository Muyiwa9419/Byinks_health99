const http = require('http');
const { app, corsOrigins } = require('./app');
const { sequelize } = require('./models');
const { initSockets } = require('./sockets');
const adminRoutes = require('./routes/adminRoutes');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('[db] Connection established');

    // In development, keep models synchronized automatically.
    // In production, use proper migrations.
    await sequelize.sync({
      alter: process.env.NODE_ENV !== 'production',
    });

    console.log('[db] Models synced');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    initSockets(
      server,
      corsOrigins.length ? corsOrigins : '*'
    );

    // Start server
    server.listen(PORT, () => {
      console.log(
        `[server] Byinks Health API listening on port ${PORT}`
      );
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

start();