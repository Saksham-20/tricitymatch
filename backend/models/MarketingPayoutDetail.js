const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Where a marketing rep is paid. One row per rep (migration 000092).
 *
 * `payload` is an AES-256-GCM blob produced by utils/payoutDetails.js holding
 * the UPI id / bank account / IFSC / PAN. Never read or write it directly:
 * go through that module, which also masks values for the rep's own view.
 */
const MarketingPayoutDetail = sequelize.define('MarketingPayoutDetail', {
  marketingUserId: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  method: { type: DataTypes.STRING(8), allowNull: false },
  payload: { type: DataTypes.TEXT, allowNull: false },
}, {
  tableName: 'MarketingPayoutDetails',
  timestamps: true,
});

module.exports = MarketingPayoutDetail;
