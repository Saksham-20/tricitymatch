const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  type: {
    type: DataTypes.ENUM(
      'new_match',
      'new_message',
      'verification_approved',
      'verification_rejected',
      'subscription_expiring',
      'profile_view',
      'report_reviewed',
      'system'
    ),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Optional UUID reference to a related entity (matchId, messageId, etc.)
  relatedId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ['userId', 'isRead'] },
    { fields: ['userId', 'createdAt'] },
  ],
});

module.exports = Notification;
