'use strict';

/**
 * Family Group chat backend (REF-51): Groups, GroupMembers, GroupMessages.
 * Membership (GroupMembers) is the authorization boundary for group reads/writes.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Groups', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: true },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      candidateUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('GroupMembers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      groupId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: { type: Sequelize.ENUM('owner', 'member'), allowNull: false, defaultValue: 'member' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('GroupMessages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      groupId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      isEdited: { type: Sequelize.BOOLEAN, defaultValue: false },
      editedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "groups_created_by" ON "Groups" ("createdBy");');
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "group_members_group_user" ON "GroupMembers" ("groupId", "userId");');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "group_members_user" ON "GroupMembers" ("userId");');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "group_messages_group_created" ON "GroupMessages" ("groupId", "createdAt");');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('GroupMessages');
    await queryInterface.dropTable('GroupMembers');
    await queryInterface.dropTable('Groups');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_GroupMembers_role";');
  },
};
