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
    },
    // Exists in the database (migration 000012); the view write relies on it for
    // ON CONFLICT, so declare it here where it is visible.
    {
      name: 'idx_profile_views_viewer_viewed_unique',
      unique: true,
      fields: ['viewerId', 'viewedUserId']
    }
  ]
});

module.exports = ProfileView;

