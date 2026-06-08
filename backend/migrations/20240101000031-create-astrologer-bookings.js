'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AstrologerBookings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      astrologerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Astrologers', key: 'id' },
        onDelete: 'CASCADE',
      },
      scheduledAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      durationMin: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      amountPaise: {
        type: Sequelize.INTEGER, // Razorpay amount in paise
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending_payment', 'confirmed', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending_payment',
      },
      razorpayOrderId: {
        type: Sequelize.STRING(128),
        allowNull: true,
        unique: true,
      },
      razorpayPaymentId: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      agoraChannel: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      callStartedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      callEndedAt: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('AstrologerBookings', ['userId']);
    await queryInterface.addIndex('AstrologerBookings', ['astrologerId']);
    await queryInterface.addIndex('AstrologerBookings', ['status']);
    await queryInterface.addIndex('AstrologerBookings', ['razorpayOrderId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AstrologerBookings');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AstrologerBookings_status"');
  },
};
