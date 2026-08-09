const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

// Funnel counters (Phase 0.5). Append-only and never mutated, so there is no
// updatedAt column. Writes go through utils/trackEvent.js (raw INSERT ... ON
// CONFLICT DO NOTHING against the partial unique index) — this model exists for
// the association/registry and for read queries.
const AnalyticsEvent = sequelize.define('AnalyticsEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  eventType: {
    // Plain string, app-validated against the allowlist in utils/trackEvent.js.
    // Deliberately not a PG ENUM — new event names must not need a type migration.
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  userId: {
    // NULL for the two pre-account counters (otp_send_attempted /
    // otp_verify_succeeded), which fire before any User row exists.
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
}, {
  updatedAt: false,
  indexes: [
    // Read path: stage counts + week-over-week.
    { fields: ['eventType', 'createdAt'] },
    // Dedupe for the three account-bound events. PARTIAL — the pre-account
    // counters carry userId NULL and must stay raw. Declared here as well as in
    // the migration so a dev DB built by `sequelize.sync()` (server.js) dedupes
    // the same way production does.
    { unique: true, fields: ['userId', 'eventType'], where: { userId: { [Op.ne]: null } } },
  ],
});

module.exports = AnalyticsEvent;
