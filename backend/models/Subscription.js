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
    // Keep in lockstep with the PG type `enum_Subscriptions_planType`
    // (migrations 000044 elite/nri, 000048 founding_premium) and with
    // constants/plans.js. `founding_premium` is granted, never purchased.
    type: DataTypes.ENUM('free', 'basic_premium', 'premium_plus', 'elite', 'vip', 'nri', 'founding_premium'),
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
    comment: 'Number of contact unlocks used so far.',
    validate: { min: 0 }
  },
  // Lifecycle ledger: timestamps of payment events (`paymentFailedAt`,
  // `cancelledAt`) and of mails already sent for this row. Migration 000060
  // created the column, but this model never declared it — and Sequelize
  // silently DROPS a key it has no attribute for, so `update({lifecycleMail})`
  // was a no-op, `row.lifecycleMail` always read undefined, and the "already
  // sent" check was permanently false. That is how one abandoned order was
  // mailed every hour for days. tests/unit/lifecycleLedger.test.js pins it.
  lifecycleMail: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null
  }
}, {
  validate: {
    endDateAfterStart() {
      if (this.startDate && this.endDate && new Date(this.endDate) < new Date(this.startDate)) {
        throw new Error('endDate must be >= startDate');
      }
    },
    unlocksWithinLimit() {
      if (this.contactUnlocksAllowed !== null &&
          this.contactUnlocksUsed > this.contactUnlocksAllowed) {
        throw new Error('contactUnlocksUsed cannot exceed contactUnlocksAllowed');
      }
    }
  },
  indexes: [
    // For checking active subscriptions (most common query)
    { fields: ['userId', 'status', 'planType'] },
    // Unique (partial, NULLs allowed) — a payment identifier may activate
    // exactly one subscription. Keyed on the token alone, NOT (userId, token):
    // scoping it per-user let one Google Play purchase token activate the tier
    // on unlimited accounts. Enforced in DB by migration 000052; only a
    // constraint holds under concurrent requests.
    { fields: ['razorpayPaymentId'], unique: true, where: { razorpayPaymentId: { [require('sequelize').Op.ne]: null } } }
  ]
});

// Internal bookkeeping — not part of any API shape.
Subscription.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.lifecycleMail;
  return values;
};

module.exports = Subscription;

