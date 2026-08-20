'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AstrologerBooking = sequelize.define('AstrologerBooking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  astrologerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  durationMin: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amountPaise: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending_payment', 'confirmed', 'in_progress', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending_payment',
  },
  razorpayOrderId: {
    type: DataTypes.STRING(128),
    allowNull: true,
    unique: true,
  },
  razorpayPaymentId: {
    type: DataTypes.STRING(128),
    allowNull: true,
    // Unique like razorpayOrderId above: one payment settles one booking.
    // Without this, a single genuine (order, payment, signature) triple could
    // be replayed to confirm every other pending booking. DB-enforced by
    // migration 000052 as a partial unique index (NULLs stay free).
    unique: true,
  },
  agoraChannel: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  callStartedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  callEndedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'AstrologerBookings',
  timestamps: true,
});

module.exports = AstrologerBooking;
