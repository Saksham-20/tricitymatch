const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  planType: {
    type: DataTypes.ENUM('free', 'basic_premium', 'premium_plus', 'vip'),
    defaultValue: 'free'
  },
  razorpayOrderId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  razorpayPaymentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  razorpaySignature: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'cancelled', 'pending'),
    defaultValue: 'pending'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  autoRenew: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  contactUnlocksAllowed: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'Max contact unlocks for this plan. NULL = unlimited.'
  },
  contactUnlocksUsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of contact unlocks used so far.'
  }
}, {
  indexes: [
    // For checking active subscriptions (most common query)
    { fields: ['userId', 'status', 'planType'] },
    // For finding subscriptions by payment ID
    { fields: ['razorpayPaymentId'] }
  ]
});

module.exports = Subscription;

