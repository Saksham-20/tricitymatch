'use strict';

// Admin Reports moderation UI drives a 4-state workflow
// (pending → reviewing → resolved | dismissed), but the enum only had
// pending/reviewed/dismissed, so the "Mark Reviewing" and "Resolve" actions
// 400'd at the validator and could never persist. Add the two missing values.
// Legacy `reviewed` stays in the enum for any already-stored rows.
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Reports_status\" ADD VALUE IF NOT EXISTS 'reviewing'"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Reports_status\" ADD VALUE IF NOT EXISTS 'resolved'"
      );
    }
    // Non-postgres (sqlite test) enums are string-backed — nothing to alter.
  },

  async down() {
    // Postgres cannot drop enum values without recreating the type; the added
    // values are harmless if unused, so this is intentionally a no-op.
  }
};
