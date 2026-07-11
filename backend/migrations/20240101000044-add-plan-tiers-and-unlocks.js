'use strict';

// Pricing revamp: add two new subscription tiers (`elite`, `nri`) to the
// planType enum and create the UnlockPurchases table for à-la-carte
// contact-unlock top-ups. Enum-add mirrors precedent 000043/000019 (Postgres
// ADD VALUE IF NOT EXISTS; irreversible — down is a no-op for the enum).
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_Subscriptions_planType" ADD VALUE IF NOT EXISTS \'elite\''
      );
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_Subscriptions_planType" ADD VALUE IF NOT EXISTS \'nri\''
      );
    }
    // Non-postgres (sqlite test) enums are string-backed — nothing to alter.

    await queryInterface.createTable('UnlockPurchases', {
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
      bundleId: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      unlocks: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      razorpayOrderId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      razorpayPaymentId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'cancelled'),
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

    // Idempotent (a prior partial run / model sync may have created these).
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "unlock_purchases_user_id" ON "UnlockPurchases" ("userId");'
    );
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "unlock_purchases_razorpay_order_id" ON "UnlockPurchases" ("razorpayOrderId");'
    );
  },

  async down(queryInterface) {
    // Drop only the table we own; the two added planType enum values are left
    // in place (Postgres cannot drop enum values without recreating the type,
    // and they are harmless if unused — matches prior enum-add precedent).
    await queryInterface.dropTable('UnlockPurchases');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_UnlockPurchases_status";');
  },
};
