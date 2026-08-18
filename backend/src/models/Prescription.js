const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prescription = sequelize.define('Prescription', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  patientId: { type: DataTypes.UUID, allowNull: false },
  patientName: { type: DataTypes.STRING, allowNull: false },
  consultantId: { type: DataTypes.UUID, allowNull: false },
  consultantName: { type: DataTypes.STRING, allowNull: false },
  pharmacyId: DataTypes.UUID,
  medications: { type: DataTypes.TEXT, allowNull: false },
  dosage: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('draft', 'sent_to_pharmacy', 'preparing', 'ready_for_dispatch', 'dispatched', 'delivered'),
    defaultValue: 'draft',
  },
}, {
  tableName: 'prescriptions',
  timestamps: true,
});

module.exports = Prescription;
