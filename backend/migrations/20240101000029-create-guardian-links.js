'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('GuardianLinks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      candidateId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      guardianId: {
        type: Sequelize.UUID,
        allowNull: true, // null = pending invite (guardian not on platform yet)
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      inviteEmail: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      inviteToken: {
        type: Sequelize.STRING(128),
        allowNull: true, // null once the invite resolves to a real user
        unique: true,
      },
      inviteExpiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'revoked'),
        allowNull: false,
        defaultValue: 'pending',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('GuardianLinks', ['candidateId']);
    await queryInterface.addIndex('GuardianLinks', ['guardianId']);
    await queryInterface.addIndex('GuardianLinks', ['candidateId', 'guardianId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('GuardianLinks');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_GuardianLinks_status"');
  },
};
