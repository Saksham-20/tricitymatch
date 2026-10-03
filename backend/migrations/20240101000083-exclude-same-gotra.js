'use strict';

/**
 * Profiles.excludeSameGotra: "do not show me, and do not show me to, members
 * who share my gotra". Same-gotra marriage is a hard taboo for many of the
 * families the community pages are written for, and those pages promise the
 * switch. Default false: existing members see no change until they choose it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.describeTable('Profiles');
    if (!t.excludeSameGotra) {
      await queryInterface.addColumn('Profiles', 'excludeSameGotra', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },
  async down(queryInterface) {
    const t = await queryInterface.describeTable('Profiles');
    if (t.excludeSameGotra) await queryInterface.removeColumn('Profiles', 'excludeSameGotra');
  },
};
