'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Astrologer = sequelize.define('Astrologer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  speciality: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rating: {
    type: DataTypes.DECIMAL(3, 1),
    defaultValue: 0,
  },
  reviewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  pricePerMin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 20,
  },
  languages: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  avatarUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isOnline: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'Astrologers',
  timestamps: true,
});

module.exports = Astrologer;
