const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryOrder = sequelize.define(
  'DeliveryOrder',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    prescriptionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    patientName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    medications: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    dosage: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    pharmacyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    dispatchId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        'pending',
        'assigned',
        'in_transit',
        'delivered',
        'completed'
      ),

      defaultValue: 'pending',
    },

    patientAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    patientLocationLat: DataTypes.FLOAT,

    patientLocationLng: DataTypes.FLOAT,

    currentLocationLat: DataTypes.FLOAT,

    currentLocationLng: DataTypes.FLOAT,

    timestamp: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'delivery_orders',
    timestamps: true,
  }
);

DeliveryOrder.prototype.toPublicJSON =
  function toPublicJSON() {
    const d = this.get({
      plain: true,
    });

    const patientLocation =
      d.patientLocationLat != null &&
      d.patientLocationLng != null
        ? {
            lat: d.patientLocationLat,
            lng: d.patientLocationLng,
          }
        : undefined;

    const currentLocation =
      d.currentLocationLat != null &&
      d.currentLocationLng != null
        ? {
            lat: d.currentLocationLat,
            lng: d.currentLocationLng,
          }
        : undefined;

    delete d.patientLocationLat;
    delete d.patientLocationLng;

    delete d.currentLocationLat;
    delete d.currentLocationLng;

    return {
      ...d,

      ...(patientLocation
        ? { patientLocation }
        : {}),

      ...(currentLocation
        ? { currentLocation }
        : {}),
    };
  };

module.exports = DeliveryOrder;