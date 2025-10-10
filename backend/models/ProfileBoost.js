const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const ProfileBoost = sequelize.define('ProfileBoost', {
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
  boostStartTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  boostEndTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER, // in hours
    allowNull: false
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  paymentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Payments',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'isActive']
    },
    {
      fields: ['boostStartTime', 'boostEndTime']
    }
  ]
});

// Instance methods
ProfileBoost.prototype.isCurrentlyActive = function() {
  const now = new Date();
  return this.isActive && now >= this.boostStartTime && now <= this.boostEndTime;
};

ProfileBoost.prototype.getRemainingTime = function() {
  const now = new Date();
  if (now > this.boostEndTime) return 0;
  return Math.max(0, this.boostEndTime - now);
};

module.exports = ProfileBoost;
