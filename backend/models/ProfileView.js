const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const ProfileView = sequelize.define('ProfileView', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  viewerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  viewedUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  isRevealed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['viewerId', 'viewedUserId']
    },
    {
      fields: ['viewedUserId', 'createdAt']
    }
  ]
});

module.exports = ProfileView;
