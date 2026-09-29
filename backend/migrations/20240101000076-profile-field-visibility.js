'use strict';

// Per-field visibility for income and birth details (audit P2).
// Existing rows get an empty object, which every reader treats as "everyone",
// so nothing changes for members who never touch the setting.
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Profiles');
    if (!cols.fieldVisibility) {
      await queryInterface.addColumn('Profiles', 'fieldVisibility', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Profiles', 'fieldVisibility');
  },
};
