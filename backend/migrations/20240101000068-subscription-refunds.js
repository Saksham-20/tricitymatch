'use strict';

// Refund and dispute state on the subscription that took the payment (audit
// P0-12). Until now a refund lived only in AuditLogs: the member stayed premium,
// revenue kept counting the money, and a marketing rep kept the commission.
// Full refunds/lost disputes end the plan (status -> 'cancelled', existing enum)
// so every entitlement and revenue read that already requires an active or
// expired row excludes them without further changes.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Subscriptions');
    if (!table.refundedAmount) {
      await queryInterface.addColumn('Subscriptions', 'refundedAmount', {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0,
      });
    }
    if (!table.refunds) await queryInterface.addColumn('Subscriptions', 'refunds', { type: Sequelize.JSONB, allowNull: true });
    if (!table.refundedAt) await queryInterface.addColumn('Subscriptions', 'refundedAt', { type: Sequelize.DATE, allowNull: true });
    if (!table.disputeStatus) await queryInterface.addColumn('Subscriptions', 'disputeStatus', { type: Sequelize.STRING(20), allowNull: true });
    if (!table.disputedAt) await queryInterface.addColumn('Subscriptions', 'disputedAt', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Subscriptions');
    for (const col of ['disputedAt', 'disputeStatus', 'refundedAt', 'refunds', 'refundedAmount']) {
      if (table[col]) await queryInterface.removeColumn('Subscriptions', col);
    }
  },
};
