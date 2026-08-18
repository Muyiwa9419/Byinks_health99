const http = require('http');
const { app, corsOrigins } = require('./app');
const { sequelize } = require('./models');
const { initSockets } = require('./sockets');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('[db] Connection established');

    // In production, prefer real migrations. For this project's scale,
    // sync({ alter: true }) keeps tables in step with the models automatically.
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    console.log('[db] Models synced');

    const server = http.createServer(app);
    initSockets(server, corsOrigins.length ? corsOrigins : '*');

    server.listen(PORT, () => {
      console.log(`[server] Byinks Health API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

start();
