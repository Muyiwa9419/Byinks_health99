const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MedicalReport = sequelize.define('MedicalReport', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  patientId: { type: DataTypes.UUID, allowNull: false },
  patientName: { type: DataTypes.STRING, allowNull: false },
  fileName: { type: DataTypes.STRING, allowNull: false },
  fileUrl: DataTypes.STRING, // where the actual uploaded file lives (e.g. S3/Cloud storage URL)
  uploadDate: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending_review', 'vetted', 'rejected'),
    defaultValue: 'pending_review',
  },
  consultantNote: DataTypes.TEXT,
  vettedBy: DataTypes.STRING,
}, {
  tableName: 'medical_reports',
  timestamps: true,
});

module.exports = MedicalReport;
