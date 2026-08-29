const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * One payout to a marketing rep. See migration 000061.
 *
 * Commission EARNED is derived (rate × collected revenue) and therefore moves
 * whenever the rate changes; what has actually been handed over must not. So a
 * payout is a real row with the amount, and the rate at the time is snapshotted
 * onto it, which is what makes "outstanding" answerable months later.
 *
 * Recorded by an admin. Reps read their own, never write.
 */
const MarketingPayout = sequelize.define('MarketingPayout', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  marketingUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  // pending = promised/queued, paid = money has left. Both count against the
  // outstanding balance so an admin cannot accidentally queue the same payout
  // twice while the first is still in flight.
  status: {
    type: DataTypes.ENUM('pending', 'paid'),
    allowNull: false,
    defaultValue: 'paid',
  },
  // The commission rate in force when this payout was recorded. Kept so the
  // history stays readable after the rate is changed.
  rateAtPayout: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  method: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },
  reference: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  note: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  periodStart: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  periodEnd: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
}, {
  tableName: 'MarketingPayouts',
  timestamps: true,
  indexes: [
    { fields: ['marketingUserId', 'createdAt'] },
  ],
});

module.exports = MarketingPayout;
