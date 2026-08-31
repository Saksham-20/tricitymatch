'use strict';

/**
 * DPDP consent record (legal review 2026-08-26, item 11).
 *
 * Signup already gates on a Terms + Privacy checkbox; what was missing is the
 * evidence. Two additive columns on Users:
 *   - termsAcceptedAt: when the account holder accepted (stamped at creation).
 *   - termsVersion:    which version they accepted — the "Last updated" date of
 *                      the legal pages at that moment (backend/constants/legal.js).
 *
 * Existing rows stay NULL: we cannot honestly backfill a timestamp we never
 * recorded, and NULL reads as "accepted under a pre-record version" — a true
 * statement. Nothing downstream treats NULL as "did not accept".
 */
module.exports = {
  async up(queryInterface) {
    const { Sequelize } = queryInterface.sequelize;
    const table = await queryInterface.describeTable('Users');
    if (!table.termsAcceptedAt) {
      await queryInterface.addColumn('Users', 'termsAcceptedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
    if (!table.termsVersion) {
      await queryInterface.addColumn('Users', 'termsVersion', {
        type: Sequelize.STRING(32),
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Users');
    if (table.termsAcceptedAt) await queryInterface.removeColumn('Users', 'termsAcceptedAt');
    if (table.termsVersion) await queryInterface.removeColumn('Users', 'termsVersion');
  },
};
