'use strict';

/**
 * Admin-editable runtime settings (key → JSONB blob).
 *
 * Introduced for the launch-offer pricing layer: the owner must be able to
 * change launch prices / tenures / the offer deadline from the admin panel
 * WITHOUT a redeploy, so the values cannot live in env or in a JS constant.
 *
 * Deliberately a generic key/value table rather than a `LaunchOffers` table:
 * the founding-member window moved here for the same reason, and the next
 * owner-tunable knob should not need another migration.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('AppSettings').catch(() => null);
    if (table) return; // idempotent — prod auto-runs pending migrations on boot

    await queryInterface.createTable('AppSettings', {
      key: {
        type: Sequelize.STRING(64),
        primaryKey: true,
        allowNull: false,
      },
      value: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      // Who last wrote it. Nullable (a seed/boot write has no admin behind it)
      // and intentionally NOT a FK: an admin account being deleted must never
      // cascade-delete pricing.
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AppSettings');
  },
};
