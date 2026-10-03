'use strict';

/**
 * Soft-void for marketing payouts.
 *
 * A payout row is the record that money left the business, so "Remove" must not
 * destroy it. A voided payout keeps its row, who voided it, when and why, and is
 * excluded from the rep's paid-out and pending totals. Columns rather than a
 * new enum value: altering a Postgres enum is the expensive part to undo, and
 * `voidedAt IS NOT NULL` reads just as clearly.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('MarketingPayouts');
    if (!cols.voidedAt) {
      await queryInterface.addColumn('MarketingPayouts', 'voidedAt', { type: Sequelize.DATE, allowNull: true });
    }
    if (!cols.voidedBy) {
      await queryInterface.addColumn('MarketingPayouts', 'voidedBy', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
    if (!cols.voidReason) {
      await queryInterface.addColumn('MarketingPayouts', 'voidReason', { type: Sequelize.STRING(300), allowNull: true });
    }
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('MarketingPayouts');
    for (const c of ['voidReason', 'voidedBy', 'voidedAt']) {
      if (cols[c]) await queryInterface.removeColumn('MarketingPayouts', c);
    }
  },
};
