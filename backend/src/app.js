require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const syncRoutes = require('./routes/syncRoutes');
const chatRoutes = require('./routes/chatRoutes');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

const corsOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  helmet()
);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : '*',
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '5mb',
  })
);

app.use(
  morgan(
    process.env.NODE_ENV === 'development'
      ? 'dev'
      : 'combined'
  )
);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/sync-requests', syncRoutes);
app.use('/api/chat', chatRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = {
  app,
  corsOrigins,
};