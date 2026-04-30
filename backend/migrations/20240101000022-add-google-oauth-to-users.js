'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('Users');

    if (!tableDesc.googleId) {
      await queryInterface.addColumn('Users', 'googleId', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });
    }

    // Allow password to be null for OAuth-only users
    await queryInterface.changeColumn('Users', 'password', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'googleId');
    await queryInterface.changeColumn('Users', 'password', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
