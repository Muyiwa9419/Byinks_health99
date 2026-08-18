const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// blockedSlots shape: { "2026-08-05": ["09:00", "09:30"], ... }
const ConsultantAvailability = sequelize.define('ConsultantAvailability', {
  consultantId: { type: DataTypes.UUID, primaryKey: true },
  blockedSlots: { type: DataTypes.JSON, defaultValue: {} },
}, {
  tableName: 'consultant_availability',
  timestamps: true,
});

module.exports = ConsultantAvailability;
