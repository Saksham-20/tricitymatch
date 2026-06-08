'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CallSession = sequelize.define('CallSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  callerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  calleeId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  channelName: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('voice', 'video'),
    allowNull: false,
    defaultValue: 'voice',
  },
  status: {
    type: DataTypes.ENUM('initiated', 'accepted', 'declined', 'missed', 'ended'),
    allowNull: false,
    defaultValue: 'initiated',
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  durationSeconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

module.exports = CallSession;
