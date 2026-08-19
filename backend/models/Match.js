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
  },
  // D3 like-with-note (like action only; sanitized + capped in controller)
  note: {
    type: DataTypes.STRING(280),
    allowNull: true
  },
  // D3/ES8: SNAPSHOT of the liked thing — {type:'photo', photoUrl} |
  // {type:'prompt', promptText}. Never index-keyed (indexes rot on gallery
  // delete/reorder); clients render from the snapshot.
  likedItem: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  hooks: {
    beforeCreate(match) {
      if (match.userId === match.matchedUserId) {
        throw new Error('Cannot match with yourself');
      }
    }
  },
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

