'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Profiles', 'profileVisibility', {
      type: Sequelize.ENUM('everyone', 'matches_only'),
      defaultValue: 'everyone',
      allowNull: false,
    });
    await queryInterface.addColumn('Profiles', 'showOnlineStatus', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });
    await queryInterface.addColumn('Profiles', 'showLastSeen', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeColumn('Profiles', 'profileVisibility');
    await queryInterface.removeColumn('Profiles', 'showOnlineStatus');
    await queryInterface.removeColumn('Profiles', 'showLastSeen');
    // Drop the ENUM type created for profileVisibility
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Profiles_profileVisibility";'
    );
  },
};
