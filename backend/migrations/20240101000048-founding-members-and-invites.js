'use strict';

/**
 * Phase S — founding members + member invite links.
 *
 * Three independent pieces, one migration:
 *
 * 1. `founding_premium` on the Subscriptions planType enum. This is a GRANTED
 *    tier (utils/foundingGrant.js), never a purchasable one — `PURCHASABLE_PLANS`
 *    in constants/plans.js keeps it out of create-order. `ALTER TYPE ADD VALUE`
 *    is irreversible in Postgres (dropping an enum label means recreating the
 *    type), so `down` leaves the label in place — precedent 000043/000044.
 *    CRITICAL: no row may be INSERTed with the new label in the same transaction
 *    that adds it (Postgres cannot see an uncommitted enum value), which is why
 *    this migration only widens the type and the grant happens at runtime.
 *
 * 2. `Users.isFoundingMember` — founding-ness must survive the subscription row
 *    it was granted with. `verifyPayment` supersedes (cancels) the active
 *    founding row when a founding member upgrades, and the whole cohort's rows
 *    expire together at FOUNDING_PERIOD_ENDS; the badge has to outlive both, so
 *    it is a User column, not a subscription lookup.
 *
 * 3. Member invites: `Users.inviteToken` (unique, ≥128-bit random, minted
 *    lazily) + `Users.invitedBy` self-FK. Deliberately NOT the marketing
 *    `ReferralCode` table (its marketingUserId FK is ON DELETE CASCADE to a
 *    marketing account — wrong semantics), and deliberately NOT derived from
 *    `utils/profileCode.js` (a profileCode resolves to a full profile through
 *    `GET /search/by-code`; an invite token must resolve to a first name and
 *    nothing else). `invitedBy` is ON DELETE SET NULL so deleting an inviter
 *    never cascades away the people they brought in.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_Subscriptions_planType" ADD VALUE IF NOT EXISTS \'founding_premium\''
      );
    }
    // Non-postgres (sqlite test) enums are string-backed — nothing to alter.

    await queryInterface.addColumn('Users', 'isFoundingMember', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('Users', 'inviteToken', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'invitedBy', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Unique index rather than a `unique: true` column attribute: it is the
    // collision backstop for the random-token retry loop in utils/inviteToken.js,
    // and IF NOT EXISTS keeps a partial re-run idempotent (matches 000044).
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "users_invite_token" ON "Users" ("inviteToken");'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "users_invited_by" ON "Users" ("invitedBy");'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "users_invited_by";');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "users_invite_token";');
    await queryInterface.removeColumn('Users', 'invitedBy');
    await queryInterface.removeColumn('Users', 'inviteToken');
    await queryInterface.removeColumn('Users', 'isFoundingMember');
    // The `founding_premium` planType enum label is intentionally NOT removed:
    // Postgres cannot drop an enum value without recreating the type (and every
    // column that uses it). It is inert when unused. Same call made by 000044.
  },
};
