'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ContactUnlocks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      targetUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Unique constraint: one unlock per user-target pair
    await queryInterface.addIndex('ContactUnlocks', ['userId', 'targetUserId'], {
      unique: true,
      name: 'contact_unlocks_user_target_unique'
    });

    // For counting unlocks by a user
    await queryInterface.addIndex('ContactUnlocks', ['userId'], {
      name: 'contact_unlocks_user_id'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ContactUnlocks');
  }
};
