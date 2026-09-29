'use strict';

// Which partner preferences a member will not compromise on (audit P2).
// Empty by default, so no existing search changes.
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Profiles');
    if (!cols.mustHavePreferences) {
      await queryInterface.addColumn('Profiles', 'mustHavePreferences', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Profiles', 'mustHavePreferences');
  },
};
