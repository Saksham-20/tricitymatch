'use strict';

/**
 * `MarketingPayouts` — what has actually been handed to a marketing rep.
 *
 * Commission earned is derived (rate × collected revenue), so it moves the
 * moment an admin changes the rate. What was paid must not move, and
 * "outstanding" is only answerable if the payments are recorded rather than
 * inferred — hence a real table, with the rate snapshotted onto each row so the
 * history stays readable after a rate change.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // `sequelize.sync()` runs in development (server.js) and may already have
    // created this from the model, so tolerate an existing table.
    const tables = await queryInterface.showAllTables();
    if (tables.includes('MarketingPayouts')) return;

    await queryInterface.createTable('MarketingPayouts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      marketingUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      status: {
        type: Sequelize.ENUM('pending', 'paid'),
        allowNull: false,
        defaultValue: 'paid',
      },
      rateAtPayout: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      method: { type: Sequelize.STRING(32), allowNull: true },
      reference: { type: Sequelize.STRING(128), allowNull: true },
      note: { type: Sequelize.STRING(500), allowNull: true },
      periodStart: { type: Sequelize.DATEONLY, allowNull: true },
      periodEnd: { type: Sequelize.DATEONLY, allowNull: true },
      paidAt: { type: Sequelize.DATE, allowNull: true },
      // SET NULL, not CASCADE: removing an admin account must not erase the
      // record of a payment that was made.
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('MarketingPayouts', ['marketingUserId', 'createdAt'], {
      name: 'marketing_payouts_user_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MarketingPayouts');
    // Postgres keeps the enum type behind after the table is dropped.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_MarketingPayouts_status";');
  },
};
