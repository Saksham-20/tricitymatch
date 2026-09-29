'use strict';

// Scam/phishing signals found in a chat message (audit P2): an array of codes
// such as ["upi_id","suspicious_link"], NULL when nothing was found. Read by the
// recipient's client to show a warning; see utils/chatSafety.
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Messages');
    if (!cols.safetyFlags) {
      await queryInterface.addColumn('Messages', 'safetyFlags', { type: Sequelize.JSONB, allowNull: true });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Messages', 'safetyFlags');
  },
};
