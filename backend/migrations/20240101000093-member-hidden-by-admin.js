'use strict';

/**
 * Invisible members (admin "quiet hide").
 *
 * An admin can take a member out of everything other members browse (search,
 * daily matches, profile-code lookup, saved-search alerts, the weekly digest)
 * without banning them. The member can still sign in and use the app, and
 * anyone they contact can still see them, as with incognito. They are not told.
 *
 *   hiddenAt      when the admin hid them (null = visible)
 *   hiddenBy      which admin did it
 *   hiddenReason  the admin's note, shown only in the admin panel
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Users');
    if (!cols.hiddenAt) {
      await queryInterface.addColumn('Users', 'hiddenAt', { type: Sequelize.DATE, allowNull: true, defaultValue: null });
    }
    if (!cols.hiddenBy) {
      await queryInterface.addColumn('Users', 'hiddenBy', {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
    if (!cols.hiddenReason) {
      await queryInterface.addColumn('Users', 'hiddenReason', { type: Sequelize.STRING(300), allowNull: true, defaultValue: null });
    }
    // Listings exclude hidden members with a sub-select on this column.
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "users_hidden_at_idx" ON "Users" ("hiddenAt") WHERE "hiddenAt" IS NOT NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "users_hidden_at_idx"');
    const cols = await queryInterface.describeTable('Users');
    if (cols.hiddenReason) await queryInterface.removeColumn('Users', 'hiddenReason');
    if (cols.hiddenBy) await queryInterface.removeColumn('Users', 'hiddenBy');
    if (cols.hiddenAt) await queryInterface.removeColumn('Users', 'hiddenAt');
  },
};
