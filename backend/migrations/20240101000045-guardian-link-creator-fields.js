'use strict';

// When a guardian creates a profile FOR someone else during onboarding, we now
// persist who they are as a GuardianLink (candidate → their creator). The link
// already stored inviteEmail; add the creator's name/phone/relationship so that
// contact info (previously collected then silently dropped) is kept + shown in
// "my guardians". All nullable — existing candidate-invited links leave them null.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('GuardianLinks');
    if (!table.guardianName) {
      await queryInterface.addColumn('GuardianLinks', 'guardianName', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }
    if (!table.guardianPhone) {
      await queryInterface.addColumn('GuardianLinks', 'guardianPhone', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }
    if (!table.relationship) {
      await queryInterface.addColumn('GuardianLinks', 'relationship', {
        type: Sequelize.STRING(40),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('GuardianLinks', 'guardianName');
    await queryInterface.removeColumn('GuardianLinks', 'guardianPhone');
    await queryInterface.removeColumn('GuardianLinks', 'relationship');
  },
};
