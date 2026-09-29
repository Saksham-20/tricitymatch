const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * What a moderation report rested on, kept after the reported member erases
 * their account. No foreign keys on purpose (it must outlive the user row);
 * purged after `preserveUntil` by the daily evidence-purge job.
 */
const EvidenceArchive = sequelize.define('EvidenceArchive', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  subjectUserId: { type: DataTypes.UUID, allowNull: false },
  reportId: { type: DataTypes.UUID, allowNull: true },
  reason: { type: DataTypes.STRING(40), allowNull: true },
  payload: { type: DataTypes.JSONB, allowNull: false },
  preserveUntil: { type: DataTypes.DATE, allowNull: false },
}, {
  indexes: [{ fields: ['subjectUserId'] }, { fields: ['preserveUntil'] }],
});

module.exports = EvidenceArchive;
