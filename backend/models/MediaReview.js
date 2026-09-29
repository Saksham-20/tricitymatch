const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * A photo waiting for a human decision. See migration 000070 and
 * utils/imageModeration.
 */
const MediaReview = sequelize.define('MediaReview', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  url: { type: DataTypes.TEXT, allowNull: false },
  source: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'auto' },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pending' },
  provider: { type: DataTypes.STRING(40), allowNull: true },
  labels: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  wasProfilePhoto: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  reportId: { type: DataTypes.UUID, allowNull: true },
  decidedBy: { type: DataTypes.UUID, allowNull: true },
  decisionNote: { type: DataTypes.TEXT, allowNull: true },
  decidedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [{ fields: ['status', 'createdAt'] }, { fields: ['userId'] }],
});

module.exports = MediaReview;
