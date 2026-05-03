'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Store FCM device tokens as an array — one user may be logged in on multiple devices
    await queryInterface.addColumn('Users', 'fcmTokens', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: false,
      defaultValue: []
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'fcmTokens');
  }
};
