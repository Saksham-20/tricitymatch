'use strict';

/**
 * Thin funnel baseline (Phase 0.5): a single append-only counter table read by
 * SQL (`scripts/funnel-report.sql`) until traffic earns a dashboard.
 *
 * `eventType` is a plain STRING(32) validated in the app, NOT a PG ENUM:
 * later phases add event names (e.g. `invited_signup`) and `ALTER TYPE ADD VALUE`
 * is irreversible friction for an internal table.
 *
 * Two index shapes:
 *  - btree (eventType, createdAt) — the read path (stage counts, week-over-week).
 *  - PARTIAL unique (userId, eventType) WHERE userId IS NOT NULL — dedupes the
 *    three account-bound events to once-per-user via ON CONFLICT DO NOTHING. The
 *    partial predicate is required: the two pre-account counters carry userId NULL,
 *    and Postgres treats NULLs as distinct anyway, so they stay raw counters.
 *
 * Privacy: no metadata blob at all, and `userId` is ON DELETE CASCADE — deleting
 * an account erases its funnel history (DPDP-first; documented in the SQL).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AnalyticsEvents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      eventType: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "analytics_events_type_created" ON "AnalyticsEvents" ("eventType", "createdAt");'
    );
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "analytics_events_user_type" ON "AnalyticsEvents" ("userId", "eventType") WHERE "userId" IS NOT NULL;'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AnalyticsEvents');
  },
};
