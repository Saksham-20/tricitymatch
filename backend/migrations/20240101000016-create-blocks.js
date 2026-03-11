'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Blocks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      blockerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      blockedUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Prevent duplicate blocks (each pair can only be blocked once)
    const run16 = (sql) => queryInterface.sequelize.query(sql);
    await run16('CREATE UNIQUE INDEX IF NOT EXISTS "blocks_unique_pair" ON "Blocks" ("blockerId", "blockedUserId")');
    await run16('CREATE INDEX IF NOT EXISTS "blocks_blocker_id" ON "Blocks" ("blockerId")');
    await run16('CREATE INDEX IF NOT EXISTS "blocks_blocked_user_id" ON "Blocks" ("blockedUserId")');
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('Blocks');
  },
};
