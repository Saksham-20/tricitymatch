const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Verification = sequelize.define('Verification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  documentType: {
    type: DataTypes.ENUM('aadhaar', 'pan', 'passport', 'driving_license'),
    allowNull: true
  },
  documentFront: {
    type: DataTypes.STRING,
    allowNull: true
  },
  documentBack: {
    type: DataTypes.STRING,
    allowNull: true
  },
  selfiePhoto: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'flagged'),
    defaultValue: 'pending'
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  verifiedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  // APP-060 — background check fields
  bgCheckStatus: {
    type: DataTypes.ENUM('not_requested', 'pending_payment', 'in_progress', 'passed', 'failed'),
    defaultValue: 'not_requested',
    allowNull: false,
  },
  bgCheckRequestedAt: { type: DataTypes.DATE, allowNull: true },
  bgCheckCompletedAt: { type: DataTypes.DATE, allowNull: true },
  bgCheckRazorpayOrderId: { type: DataTypes.STRING(128), allowNull: true },
  bgCheckRazorpayPaymentId: { type: DataTypes.STRING(128), allowNull: true },
  bgCheckReportRef: { type: DataTypes.STRING(255), allowNull: true },
  bgCheckProviderRef: { type: DataTypes.STRING(255), allowNull: true }, // provider-assigned report/task ID for webhook correlation
  // APP-052 — selfie liveness
  selfieStatus: {
    type: DataTypes.ENUM('not_submitted', 'pending', 'passed', 'failed'),
    defaultValue: 'not_submitted',
    allowNull: false,
  },
  selfieVideoUrl: { type: DataTypes.TEXT, allowNull: true },
});

module.exports = Verification;

