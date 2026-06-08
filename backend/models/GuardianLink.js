'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GuardianLink = sequelize.define('GuardianLink', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  candidateId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  guardianId: {
    type: DataTypes.UUID,
    allowNull: true, // null = pending invite (guardian not on platform yet)
  },
  inviteEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: { isEmail: true },
  },
  inviteToken: {
    type: DataTypes.STRING(128),
    allowNull: true,
    unique: true,
  },
  inviteExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'revoked'),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  tableName: 'GuardianLinks',
  timestamps: true,
});

module.exports = GuardianLink;
