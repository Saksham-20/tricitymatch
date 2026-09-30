'use strict';

// Extra report categories (audit P0-6). Postgres enums cannot drop a value, so
// `down` is intentionally a no-op: leaving unused labels on the type is harmless,
// while recreating the type would rewrite every report row.
const NEW_REASONS = ['financial_scam', 'threats', 'stolen_photos', 'misleading_info'];

module.exports = {
  async up(queryInterface) {
    for (const reason of NEW_REASONS) {
      // ADD VALUE cannot run inside a transaction on older Postgres; migrations
      // here run without one.
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_Reports_reason" ADD VALUE IF NOT EXISTS '${reason}';`
      );
    }
  },

  async down() {
    // no-op: see header.
  },
};
