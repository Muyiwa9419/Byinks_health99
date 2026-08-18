const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatThread = sequelize.define('ChatThread', {
  chatId: { type: DataTypes.STRING, primaryKey: true }, // e.g. "userA--userB"
  participants: { type: DataTypes.JSON, allowNull: false }, // array of user IDs
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'chat_threads',
  timestamps: false,
});

const ChatMessage = sequelize.define('ChatMessage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  chatId: { type: DataTypes.STRING, allowNull: false },
  senderId: { type: DataTypes.UUID, allowNull: false },
  senderName: { type: DataTypes.STRING, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  time: { type: DataTypes.STRING, allowNull: false },
  timestamp: { type: DataTypes.BIGINT, allowNull: false },
  isSystem: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'chat_messages',
  timestamps: false,
});

module.exports = { ChatThread, ChatMessage };
