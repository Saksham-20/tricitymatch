const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
  }
}, {
  indexes: [
    {
      fields: ['viewedUserId', 'createdAt']
    }
  ]
});

module.exports = ProfileView;

