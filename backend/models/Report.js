const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { REPORT_REASONS } = require('../constants/reportReasons');

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  reporterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  reportedUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  reason: {
    type: DataTypes.ENUM(...REPORT_REASONS),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    // pending → reviewing → resolved | dismissed. `reviewed` kept for legacy rows.
    type: DataTypes.ENUM('pending', 'reviewing', 'reviewed', 'resolved', 'dismissed'),
    defaultValue: 'pending',
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // 'urgent' for threats, underage, financial scam, stolen photos and
  // inappropriate content (constants/reportReasons HIGH_RISK_REASONS): surfaced
  // first in the queue and mailed to staff at once.
  priority: {
    type: DataTypes.STRING(12),
    allowNull: false,
    defaultValue: 'normal',
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  escalatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ['reportedUserId', 'status'] },
    { fields: ['reporterId'] },
    { fields: ['status'] },
  ],
});

module.exports = Report;
