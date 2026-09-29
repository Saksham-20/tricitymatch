'use strict';

// Notification preferences live on the server (audit P1-10). They used to be a
// localStorage key on the web that nothing read, so the toggles did nothing.
// NULL = never chosen = defaults.
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Users');
    if (!cols.notificationPrefs) {
      await queryInterface.addColumn('Users', 'notificationPrefs', { type: Sequelize.JSONB, allowNull: true });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'notificationPrefs');
  },
};
