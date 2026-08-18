const sequelize = require('../config/database');

const User = require('./User');
const Appointment = require('./Appointment');
const ConsultantAvailability = require('./ConsultantAvailability');
const MedicalReport = require('./MedicalReport');
const Prescription = require('./Prescription');
const DeliveryOrder = require('./DeliveryOrder');
const Notification = require('./Notification');
const Transaction = require('./Transaction');
const { ChatThread, ChatMessage } = require('./Chat');
const SyncRequest = require('./SyncRequest');

// Associations (loose FKs on purpose — patient/consultant IDs reference User.id
// but we don't hard-enforce cross-table FK constraints so partial/demo data
// seeded independently of users doesn't break).
User.hasMany(Appointment, { foreignKey: 'patientId', constraints: false });
User.hasMany(Appointment, { foreignKey: 'consultantId', constraints: false });
User.hasMany(MedicalReport, { foreignKey: 'patientId', constraints: false });
User.hasMany(Prescription, { foreignKey: 'patientId', constraints: false });
User.hasMany(Notification, { foreignKey: 'userId', constraints: false });
User.hasMany(Transaction, { foreignKey: 'userId', constraints: false });
User.hasOne(ConsultantAvailability, { foreignKey: 'consultantId', constraints: false });

ChatThread.hasMany(ChatMessage, { foreignKey: 'chatId', sourceKey: 'chatId', constraints: false });
ChatMessage.belongsTo(ChatThread, { foreignKey: 'chatId', targetKey: 'chatId', constraints: false });

module.exports = {
  sequelize,
  User,
  Appointment,
  ConsultantAvailability,
  MedicalReport,
  Prescription,
  DeliveryOrder,
  Notification,
  Transaction,
  ChatThread,
  ChatMessage,
  SyncRequest,
};
