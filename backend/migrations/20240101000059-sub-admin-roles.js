'use strict';

/**
 * Sub-admins: a `sub_admin` role plus a per-account scope list.
 *
 * Two changes, both additive:
 *  1. `enum_Users_role` gains `sub_admin`. Postgres cannot ADD VALUE inside a
 *     transaction that later uses it, and umzug wraps migrations, so this is
 *     issued on its own with IF NOT EXISTS (safe to re-run).
 *  2. `Users.adminPermissions` — JSONB array of scope keys. NULL for everyone
 *     who is not a sub-admin: `admin`/`super_admin` hold every scope
 *     implicitly (constants/adminScopes.js), so storing a list for them would
 *     be a second source of truth that goes stale the moment a scope is added.
 *
 * IRREVERSIBLE HALF: Postgres cannot drop a value from an enum type. `down`
 * therefore demotes any sub_admin to `user` (they lose panel access, which is
 * the safe direction) and drops the column, but leaves the enum value behind.
 */

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'sub_admin'`
    );

    const table = await queryInterface.describeTable('Users');
    if (!table.adminPermissions) {
      await queryInterface.addColumn('Users', 'adminPermissions', {
        type: queryInterface.sequelize.Sequelize.JSONB,
        allowNull: true,
        comment: 'Scope keys for sub_admin accounts; NULL for every other role',
      });
    }
  },

  async down(queryInterface) {
    // Demote before dropping the column, or a sub_admin would keep panel
    // access with no scopes to read — a role that can log in and see nothing.
    await queryInterface.sequelize.query(
      `UPDATE "Users" SET "role" = 'user' WHERE "role" = 'sub_admin'`
    );

    const table = await queryInterface.describeTable('Users');
    if (table.adminPermissions) {
      await queryInterface.removeColumn('Users', 'adminPermissions');
    }
    // The enum value stays: Postgres has no DROP VALUE, and recreating the
    // type would require rewriting every dependent column.
  },
};
