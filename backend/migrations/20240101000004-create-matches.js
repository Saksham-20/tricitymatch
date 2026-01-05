'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Matches', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      matchedUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      action: {
        type: Sequelize.ENUM('like', 'shortlist', 'pass'),
        allowNull: false
      },
      compatibilityScore: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      isMutual: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      mutualMatchDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('Matches', ['userId', 'matchedUserId'], {
      unique: true,
      name: 'unique_user_match'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Matches');
  }
};

