const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MarketingLead = sequelize.define('MarketingLead', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true
  },
  campaign: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referralCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  assignedToMarketingUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('new', 'contacted', 'converted', 'lost'),
    defaultValue: 'new'
  },
  paymentStatus: {
    type: DataTypes.ENUM('none', 'paid'),
    defaultValue: 'none'
  },
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  convertedUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
});

module.exports = MarketingLead;
