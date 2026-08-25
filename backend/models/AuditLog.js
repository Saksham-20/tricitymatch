const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Append-only record of privileged admin actions. Written best-effort by
// `logAudit` (middlewares/logger.js) alongside the JSON app log — the log line
// stays the source of truth for incident forensics, this table is what the
// Admins & Roles / audit screen reads. No updatedAt: rows are never mutated.
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  action: { type: DataTypes.STRING(64), allowNull: false },
  actorId: { type: DataTypes.UUID, allowNull: true },
  targetUserId: { type: DataTypes.UUID, allowNull: true },
  details: { type: DataTypes.JSONB, allowNull: true },
}, {
  updatedAt: false,
  indexes: [{ fields: ['createdAt'] }, { fields: ['action'] }],
});

module.exports = AuditLog;
