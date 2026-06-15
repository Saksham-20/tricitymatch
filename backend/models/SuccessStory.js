'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuccessStory = sequelize.define('SuccessStory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  coupleNames: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  marriedOn: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  quote: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  photoUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  tag: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('draft', 'published'),
    allowNull: false,
    defaultValue: 'draft',
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'SuccessStories',
  indexes: [
    { fields: ['status', 'displayOrder'] },
  ],
});

module.exports = SuccessStory;
