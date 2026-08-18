const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  type: {
    type: DataTypes.ENUM('consultation', 'subscription', 'pharmacy'),
    allowNull: false,
  },
  timestamp: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.STRING,
}, {
  tableName: 'transactions',
  timestamps: true,
});

module.exports = Transaction;
