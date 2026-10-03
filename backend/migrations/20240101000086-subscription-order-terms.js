'use strict';

/**
 * `Subscriptions.orderTerms` — the commercial terms a member agreed to when the
 * order was created: { duration (days), contactUnlocks (null = unlimited) }.
 *
 * The Razorpay order amount is fixed at create-order, but duration and unlock
 * allowance used to be re-resolved from the live launch offer at activation, so
 * an admin edit (or the offer deadline passing) between the two silently sold a
 * buyer different terms from the ones they paid for. Activation now reads this
 * snapshot; rows without one (orders already open, admin grants, Google Play)
 * keep resolving from the live plan exactly as before.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Subscriptions');
    if (!cols.orderTerms) {
      await queryInterface.addColumn('Subscriptions', 'orderTerms', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('Subscriptions');
    if (cols.orderTerms) await queryInterface.removeColumn('Subscriptions', 'orderTerms');
  },
};
