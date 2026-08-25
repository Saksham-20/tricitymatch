'use strict';

/**
 * Audit trail + lifecycle-mail bookkeeping (2026-08-25 priority audit, P0/P1).
 *
 * NOT included here: analytics. `AnalyticsEvents` already exists (migration
 * 000047) and `utils/trackEvent.js` already writes funnel stages from the auth,
 * profile and match controllers. What that table lacks is pre-signup traffic
 * stages and a way to read it — both of which are app-level, no schema change.
 *
 *  1. `AuditLogs` — `logAudit` has only ever written to the JSON app log, which
 *     nobody can read from inside the product. Plan grants and role changes are
 *     exactly what you need to look up months later, so they get a table.
 *
 *  2. `Subscriptions.lifecycleMail` / `Users.lifecycleMail` — which lifecycle
 *     mails have already gone out for that row (abandoned-checkout chase,
 *     renewal warning, expiry, win-back, no-photo nudge). Stored per row so an
 *     hourly job that re-runs cannot mail the same person twice.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // `sequelize.sync()` runs in development (server.js) and will have already
    // created this table from the model on the first boot after it landed, so
    // every step here has to tolerate already existing.
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('AuditLogs')) {
      await queryInterface.createTable('AuditLogs', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        action: { type: Sequelize.STRING(64), allowNull: false },
        // SET NULL, not CASCADE: deleting an admin account must not erase the
        // record of what that account did.
        actorId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE',
        },
        targetUserId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE',
        },
        details: { type: Sequelize.JSONB, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      });
    }
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "audit_logs_created_at" ON "AuditLogs" ("createdAt");'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "audit_logs_action" ON "AuditLogs" ("action");'
    );

    const subs = await queryInterface.describeTable('Subscriptions');
    if (!subs.lifecycleMail) {
      await queryInterface.addColumn('Subscriptions', 'lifecycleMail', {
        type: Sequelize.JSONB, allowNull: true,
        comment: 'Lifecycle emails already sent for this subscription',
      });
    }

    const users = await queryInterface.describeTable('Users');
    if (!users.lifecycleMail) {
      await queryInterface.addColumn('Users', 'lifecycleMail', {
        type: Sequelize.JSONB, allowNull: true,
        comment: 'Member-level lifecycle nudges already sent',
      });
    }
  },

  async down(queryInterface) {
    const subs = await queryInterface.describeTable('Subscriptions');
    if (subs.lifecycleMail) await queryInterface.removeColumn('Subscriptions', 'lifecycleMail');
    const users = await queryInterface.describeTable('Users');
    if (users.lifecycleMail) await queryInterface.removeColumn('Users', 'lifecycleMail');
    await queryInterface.dropTable('AuditLogs');
  },
};
