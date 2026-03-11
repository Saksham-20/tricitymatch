const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ContactUnlock = sequelize.define('ContactUnlock', {
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
  targetUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  indexes: [
    // Unique constraint: one unlock per user-target pair
    { unique: true, fields: ['userId', 'targetUserId'] },
    // For counting unlocks by a user
    { fields: ['userId'] }
  ]
});

module.exports = ContactUnlock;
