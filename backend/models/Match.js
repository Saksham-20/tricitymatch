const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Match = sequelize.define('Match', {
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
  matchedUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.ENUM('like', 'shortlist', 'pass'),
    allowNull: false
  },
  compatibilityScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  isMutual: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  mutualMatchDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['userId', 'matchedUserId']
    },
    // For "who liked me" queries
    { fields: ['matchedUserId', 'action'] },
    // For mutual match lookups
    { fields: ['isMutual'] }
  ]
});

module.exports = Match;

