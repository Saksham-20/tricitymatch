'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Payments', {
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
      orderId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      paymentId: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: 'INR',
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
        defaultValue: 'pending',
        allowNull: false
      },
      plan: {
        type: Sequelize.ENUM('premium', 'elite', 'boost'),
        allowNull: false
      },
      planDuration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      razorpaySignature: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      failureReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      refundAmount: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      refundDate: {
        type: Sequelize.DATE,
        allowNull: true
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
    await queryInterface.addIndex('Payments', ['userId']);
    await queryInterface.addIndex('Payments', ['orderId']);
    await queryInterface.addIndex('Payments', ['paymentId']);
    await queryInterface.addIndex('Payments', ['status']);
    await queryInterface.addIndex('Payments', ['plan']);
    await queryInterface.addIndex('Payments', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Payments');
  }
};
