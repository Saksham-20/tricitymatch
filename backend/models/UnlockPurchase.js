const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// À-la-carte contact-unlock top-up purchase. Independent of the Subscription
// row for auditing, but the purchased unlocks are APPLIED to the buyer's active
// subscription (contactUnlocksAllowed += unlocks) on verify — there is no
// separate unlock wallet, so enforcement in checkContactUnlockLimit is unchanged.
const UnlockPurchase = sequelize.define('UnlockPurchase', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  bundleId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Key of UNLOCK_BUNDLES (bundle_3 / bundle_10 / bundle_25).'
  },
  unlocks: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1 }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Amount paid in rupees.'
  },
  razorpayOrderId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  razorpayPaymentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'cancelled'),
    defaultValue: 'pending'
  }
}, {
  indexes: [
    { fields: ['userId'] },
    { unique: true, fields: ['razorpayOrderId'] }
  ]
});

module.exports = UnlockPurchase;
