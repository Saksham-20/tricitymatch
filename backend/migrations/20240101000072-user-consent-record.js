'use strict';

// Consent evidence (audit P1-8). termsAcceptedAt/termsVersion say WHAT was
// accepted; this says HOW: the request that carried the acceptance (ip, user
// agent), the optional marketing choice, and who a guardian-created profile was
// attested for. Existing rows stay NULL: a record we never made cannot be
// backfilled honestly.
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Users');
    if (!cols.consent) {
      await queryInterface.addColumn('Users', 'consent', { type: Sequelize.JSONB, allowNull: true });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'consent');
  },
};
