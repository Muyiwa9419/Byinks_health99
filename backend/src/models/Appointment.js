const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  patientId: { type: DataTypes.UUID, allowNull: false },
  consultantId: { type: DataTypes.UUID, allowNull: false },
  patientName: { type: DataTypes.STRING, allowNull: false },
  consultantName: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.STRING, allowNull: false }, // YYYY-MM-DD
  time: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
    defaultValue: 'pending',
  },
  notes: DataTypes.TEXT,
  paymentStatus: { type: DataTypes.ENUM('pending', 'paid'), defaultValue: 'pending' },
  fee: DataTypes.FLOAT,
}, {
  tableName: 'appointments',
  timestamps: true,
});

module.exports = Appointment;
