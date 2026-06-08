'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CallSessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      callerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      calleeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      channelName: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('voice', 'video'),
        allowNull: false,
        defaultValue: 'voice',
      },
      status: {
        type: Sequelize.ENUM('initiated', 'accepted', 'declined', 'missed', 'ended'),
        allowNull: false,
        defaultValue: 'initiated',
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      endedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      durationSeconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

    await queryInterface.addIndex('CallSessions', ['callerId']);
    await queryInterface.addIndex('CallSessions', ['calleeId']);
    await queryInterface.addIndex('CallSessions', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CallSessions');
  },
};
