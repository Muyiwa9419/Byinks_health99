const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SyncRequest = sequelize.define('SyncRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requesterEmail: { type: DataTypes.STRING, allowNull: false },
  deviceInfo: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  timestamp: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'sync_requests',
  timestamps: true,
});

module.exports = SyncRequest;
