'use strict';

// Pause a profile without deleting it, and schedule an account deletion with a
// grace period instead of erasing on the spot (audit P2, P8-05).
//   Profiles.pausedAt              when the member hid their profile (NULL = visible)
//   Users.deletionScheduledFor     when the account will be erased (NULL = not scheduled)
module.exports = {
  async up(queryInterface, Sequelize) {
    const profileCols = await queryInterface.describeTable('Profiles');
    if (!profileCols.pausedAt) {
      await queryInterface.addColumn('Profiles', 'pausedAt', { type: Sequelize.DATE, allowNull: true });
    }
    const userCols = await queryInterface.describeTable('Users');
    if (!userCols.deletionScheduledFor) {
      await queryInterface.addColumn('Users', 'deletionScheduledFor', { type: Sequelize.DATE, allowNull: true });
      await queryInterface.addIndex('Users', ['deletionScheduledFor'], {
        name: 'users_deletion_scheduled_for_idx',
        where: { deletionScheduledFor: { [Sequelize.Op.ne]: null } },
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('Users', 'users_deletion_scheduled_for_idx').catch(() => {});
    await queryInterface.removeColumn('Users', 'deletionScheduledFor');
    await queryInterface.removeColumn('Profiles', 'pausedAt');
  },
};
