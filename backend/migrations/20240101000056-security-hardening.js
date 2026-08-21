'use strict';

/**
 * Database security hardening (deep audit 2026-08-21).
 *
 * 1. RefreshTokens.token stored the RAW refresh token beside its SHA-256 hash.
 *    Every lookup already goes through tokenHash, so the raw column was dead
 *    weight with a live blast radius: a database dump yielded directly
 *    replayable session tokens for their full 7-day lifetime. Verified on the
 *    development database -- 733 rows, including unrevoked and unexpired ones.
 *    Existing values are nulled and the column is made nullable so nothing
 *    writes a secret there again. The column is kept (not dropped) so this
 *    migration is reversible and matches the project's handling of dormant
 *    columns.
 *
 * 2. CHECK constraints for invariants that were previously enforced only in
 *    JavaScript -- and in the case of self-matches, by a model hook that the
 *    real insert path (a raw INSERT ... ON CONFLICT in matchController)
 *    bypasses entirely.
 *
 *    Every constraint is added NOT VALID on purpose. NOT VALID enforces the
 *    rule on all new and updated rows immediately, but does not scan existing
 *    ones, so this migration cannot fail a production boot on legacy data.
 *    Production auto-runs pending migrations on startup, so a constraint that
 *    fails validation would take the service down. Validate later, deliberately:
 *      ALTER TABLE "Subscriptions" VALIDATE CONSTRAINT subscriptions_dates_ordered;
 *
 * 3. Users.role and Users.status were nullable. Both currently fail closed
 *    (adminAuth denies NULL, entitlement queries filter on 'active'), but a
 *    NULL role satisfies neither an allowlist nor a denylist and is a trap for
 *    any future check written as `role !== 'user'`. Nulls are backfilled to the
 *    documented defaults, then the columns are made NOT NULL.
 *
 * 4. Verifications.verifiedBy referenced Users with no ON DELETE rule, the only
 *    unconstrained FK in the schema. Its twin, Reports.reviewedBy, already had
 *    SET NULL. Deleting an admin who had approved a KYC record was blocked by
 *    the FK.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    // ── 1. Stop storing raw refresh tokens ──
    await queryInterface.changeColumn('RefreshTokens', 'token', {
      type: Sequelize.STRING(512),
      allowNull: true,
    });
    await sequelize.query('UPDATE "RefreshTokens" SET "token" = NULL WHERE "token" IS NOT NULL;');

    // ── 3. Backfill then tighten Users.role / Users.status ──
    await sequelize.query(`UPDATE "Users" SET "role" = 'user' WHERE "role" IS NULL;`);
    await sequelize.query(`UPDATE "Users" SET "status" = 'pending' WHERE "status" IS NULL;`);
    await sequelize.query('ALTER TABLE "Users" ALTER COLUMN "role" SET NOT NULL;');
    await sequelize.query('ALTER TABLE "Users" ALTER COLUMN "status" SET NOT NULL;');

    // ── 2. CHECK constraints (NOT VALID -- see header) ──
    const checks = [
      ['Subscriptions', 'subscriptions_dates_ordered',
        '"endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate"'],
      // An active subscription with no endDate never expires: the hourly
      // expire-subscriptions job only matches endDate < NOW(), so such a row is
      // a permanent paid plan that no cleanup can ever see.
      ['Subscriptions', 'subscriptions_active_has_end_date',
        `NOT ("status" = 'active' AND "endDate" IS NULL)`],
      ['Subscriptions', 'subscriptions_unlocks_nonnegative',
        '"contactUnlocksUsed" >= 0'],
      // Enforced today only by a beforeCreate hook, which the raw
      // INSERT ... ON CONFLICT in matchController never runs.
      ['Matches', 'matches_no_self_match', '"userId" <> "matchedUserId"'],
      ['Messages', 'messages_no_self_message', '"senderId" <> "receiverId"'],
    ];

    for (const [table, name, expr] of checks) {
      await sequelize.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expr}) NOT VALID;`
      );
    }

    // ── 4. Give Verifications.verifiedBy an ON DELETE rule ──
    const [fks] = await sequelize.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'Verifications'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'verifiedBy';
    `);
    for (const { constraint_name: name } of fks) {
      await sequelize.query(`ALTER TABLE "Verifications" DROP CONSTRAINT "${name}";`);
    }
    await sequelize.query(`
      ALTER TABLE "Verifications"
      ADD CONSTRAINT "verifications_verified_by_fkey"
      FOREIGN KEY ("verifiedBy") REFERENCES "Users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    for (const [table, name] of [
      ['Subscriptions', 'subscriptions_dates_ordered'],
      ['Subscriptions', 'subscriptions_active_has_end_date'],
      ['Subscriptions', 'subscriptions_unlocks_nonnegative'],
      ['Matches', 'matches_no_self_match'],
      ['Messages', 'messages_no_self_message'],
    ]) {
      await sequelize.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}";`);
    }

    await sequelize.query('ALTER TABLE "Users" ALTER COLUMN "role" DROP NOT NULL;');
    await sequelize.query('ALTER TABLE "Users" ALTER COLUMN "status" DROP NOT NULL;');

    // The raw token column is left nullable: restoring allowNull:false would
    // fail, since the values it used to hold are intentionally gone.
  },
};
