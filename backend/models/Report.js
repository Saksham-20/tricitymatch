const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  reporterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  reportedUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  reason: {
    type: DataTypes.ENUM(
      'fake_profile',
      'harassment',
      'spam',
      'inappropriate_content',
      'underage',
      'other'
    ),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'dismissed'),
    defaultValue: 'pending',
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ['reportedUserId', 'status'] },
    { fields: ['reporterId'] },
    { fields: ['status'] },
  ],
});

module.exports = Report;
