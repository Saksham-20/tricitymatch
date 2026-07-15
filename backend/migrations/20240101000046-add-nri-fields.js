'use strict';

// NRI / living-abroad declaration collected inline on the onboarding Location
// step. `isNri` gates the rest; residence + familyLocation describe where the
// member lives and where their family is based in India. All additive/nullable
// (isNri defaults false) so existing profiles are unaffected. Idempotent.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Profiles');
    if (!table.isNri) {
      await queryInterface.addColumn('Profiles', 'isNri', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!table.residenceCountry) {
      await queryInterface.addColumn('Profiles', 'residenceCountry', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.residenceStatus) {
      await queryInterface.addColumn('Profiles', 'residenceStatus', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.familyLocation) {
      await queryInterface.addColumn('Profiles', 'familyLocation', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Profiles', 'isNri');
    await queryInterface.removeColumn('Profiles', 'residenceCountry');
    await queryInterface.removeColumn('Profiles', 'residenceStatus');
    await queryInterface.removeColumn('Profiles', 'familyLocation');
  },
};
