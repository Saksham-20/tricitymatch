'use strict';

// Family-group invitations need an accept step. Until now an owner could put ANY
// member into a group with no consent, and that group's messages became readable
// to them immediately. `status` separates "invited" from "member": only an
// 'active' row grants access. Every existing row stays 'active' so no current
// group changes behaviour.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('GroupMembers');
    if (!table.status) {
      await queryInterface.addColumn('GroupMembers', 'status', {
        type: Sequelize.ENUM('pending', 'active'),
        allowNull: false,
        defaultValue: 'active',
      });
    }
    if (!table.invitedBy) {
      await queryInterface.addColumn('GroupMembers', 'invitedBy', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    await queryInterface
      .addIndex('GroupMembers', ['userId', 'status'], { name: 'group_members_user_status' })
      .catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('GroupMembers', 'group_members_user_status').catch(() => {});
    await queryInterface.removeColumn('GroupMembers', 'invitedBy');
    await queryInterface.removeColumn('GroupMembers', 'status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_GroupMembers_status";');
  },
};
