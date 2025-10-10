'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProfileViews', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      viewerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      viewedUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      isRevealed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      viewCount: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add unique constraint and indexes
    await queryInterface.addIndex('ProfileViews', ['viewerId', 'viewedUserId'], {
      unique: true,
      name: 'profile_views_viewer_viewed_user_unique'
    });
    await queryInterface.addIndex('ProfileViews', ['viewedUserId']);
    await queryInterface.addIndex('ProfileViews', ['viewerId']);
    await queryInterface.addIndex('ProfileViews', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ProfileViews');
  }
};
