const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  appId: DataTypes.STRING,
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  timestamp: { type: DataTypes.STRING, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  type: {
    type: DataTypes.ENUM('reminder', 'system', 'billing', 'delivery'),
    defaultValue: 'system',
  },
}, {
  tableName: 'notifications',
  timestamps: true,
});

module.exports = Notification;
