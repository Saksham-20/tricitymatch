const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReferralCode = sequelize.define('ReferralCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  marketingUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  campaign: {
    type: DataTypes.STRING,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

module.exports = ReferralCode;
