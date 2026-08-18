const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
    set(value) { this.setDataValue('email', value.toLowerCase().trim()); },
  },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.ENUM('PATIENT', 'CONSULTANT', 'PHARMACY', 'DISPATCH', 'ADMIN'),
    allowNull: false,
  },
  specialty: DataTypes.STRING,
  avatar: DataTypes.STRING,
  isApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
  isOnline: { type: DataTypes.BOOLEAN, defaultValue: false },
  age: DataTypes.INTEGER,
  bloodType: DataTypes.STRING,
  genotype: DataTypes.STRING,
  height: DataTypes.STRING,
  weight: DataTypes.STRING,
  phone: DataTypes.STRING,
  address: DataTypes.STRING,
  emergencyContactName: DataTypes.STRING,
  emergencyContactPhone: DataTypes.STRING,
  locationLat: DataTypes.FLOAT,
  locationLng: DataTypes.FLOAT,
}, {
  tableName: 'users',
  timestamps: true,
  defaultScope: {
    attributes: { exclude: ['passwordHash'] },
  },
  scopes: {
    withPassword: { attributes: {} },
  },
});

// Shape a User row the same way the frontend's `User` type expects it
User.prototype.toPublicJSON = function toPublicJSON() {
  const u = this.get({ plain: true });
  delete u.passwordHash;
  const location = (u.locationLat != null && u.locationLng != null)
    ? { lat: u.locationLat, lng: u.locationLng }
    : undefined;
  delete u.locationLat;
  delete u.locationLng;
  return { ...u, ...(location ? { location } : {}) };
};

module.exports = User;
