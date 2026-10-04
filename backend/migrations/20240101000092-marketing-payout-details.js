'use strict';

/**
 * Manual payout support for marketing reps.
 *
 * MarketingPayoutDetails: where a rep wants to be paid (UPI or bank) plus their
 * PAN. One row per rep. The sensitive values live in an encrypted blob
 * (`payload`, see utils/payoutDetails.js); only the method is a plain column so
 * the admin table can show "UPI" / "Bank" without decrypting anything.
 *
 * MarketingPayouts.tdsRate / tdsAmount: TDS withheld on a payout. `amount` stays
 * the GROSS commission settled against the rep's balance; what actually leaves
 * the bank is amount - tdsAmount. Default 0, so every existing row is unchanged.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('MarketingPayoutDetails')) {
      await queryInterface.createTable('MarketingPayoutDetails', {
        marketingUserId: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        method: { type: Sequelize.STRING(8), allowNull: false },
        payload: { type: Sequelize.TEXT, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
    }

    const cols = await queryInterface.describeTable('MarketingPayouts');
    if (!cols.tdsRate) {
      await queryInterface.addColumn('MarketingPayouts', 'tdsRate', { type: Sequelize.DECIMAL(5, 2), allowNull: true });
    }
    if (!cols.tdsAmount) {
      await queryInterface.addColumn('MarketingPayouts', 'tdsAmount', {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('MarketingPayouts');
    for (const c of ['tdsAmount', 'tdsRate']) {
      if (cols[c]) await queryInterface.removeColumn('MarketingPayouts', c);
    }
    await queryInterface.dropTable('MarketingPayoutDetails');
  },
};
