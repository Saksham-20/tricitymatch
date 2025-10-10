const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const Payment = sequelize.define('Payment', {
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
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  amount: {
    type: DataTypes.INTEGER, // in paise
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'INR'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  plan: {
    type: DataTypes.ENUM('premium', 'elite', 'boost'),
    allowNull: false
  },
  planDuration: {
    type: DataTypes.INTEGER, // in days
    allowNull: false
  },
  razorpaySignature: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  refundAmount: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  refundDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'status']
    },
    {
      fields: ['orderId']
    },
    {
      fields: ['paymentId']
    }
  ]
});

// Instance methods
Payment.prototype.getAmountInRupees = function() {
  return this.amount / 100;
};

Payment.prototype.isSuccessful = function() {
  return this.status === 'completed';
};

module.exports = Payment;
