'use strict';

// Second factor for accounts that can act on other people's data (audit P0-13).
// `mfaSecret` is stored ENCRYPTED (utils/totp.js); `mfaEnabledAt` is set only
// once the member has proved they can generate a code, so a half-finished
// enrolment never locks anyone out. Recovery codes are stored as hashes.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Users');
    if (!table.mfaSecret) await queryInterface.addColumn('Users', 'mfaSecret', { type: Sequelize.TEXT, allowNull: true });
    if (!table.mfaEnabledAt) await queryInterface.addColumn('Users', 'mfaEnabledAt', { type: Sequelize.DATE, allowNull: true });
    if (!table.mfaRecoveryHashes) await queryInterface.addColumn('Users', 'mfaRecoveryHashes', { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Users');
    for (const col of ['mfaRecoveryHashes', 'mfaEnabledAt', 'mfaSecret']) {
      if (table[col]) await queryInterface.removeColumn('Users', col);
    }
  },
};
