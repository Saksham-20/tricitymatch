'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProfileBoosts', {
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
      boostStartTime: {
        type: Sequelize.DATE,
        allowNull: false
      },
      boostEndTime: {
        type: Sequelize.DATE,
        allowNull: false
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      isPaid: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      paymentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Payments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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

    // Add indexes
    await queryInterface.addIndex('ProfileBoosts', ['userId']);
    await queryInterface.addIndex('ProfileBoosts', ['isActive']);
    await queryInterface.addIndex('ProfileBoosts', ['boostStartTime', 'boostEndTime']);
    await queryInterface.addIndex('ProfileBoosts', ['paymentId']);
    await queryInterface.addIndex('ProfileBoosts', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ProfileBoosts');
  }
};
