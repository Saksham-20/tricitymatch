'use strict';

/**
 * Checkout referral codes.
 *
 *  - `Users.referralCode`  — a short typeable code for MEMBERS (marketing reps
 *    already have `ReferralCodes`). Minted lazily; unique where set.
 *  - `Subscriptions.referral` — what code was applied to an order and what it
 *    was worth: { code, kind, discountPaise, referrerUserId, marketingUserId,
 *    rewardedAt }. One JSONB column rather than five, because the only things
 *    that read it are the activation legs and the admin/marketing reports.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable('Users');
    if (!users.referralCode) {
      await queryInterface.addColumn('Users', 'referralCode', {
        type: Sequelize.STRING(16),
        allowNull: true,
      });
    }
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code ON "Users" ("referralCode") WHERE "referralCode" IS NOT NULL'
    );

    const subs = await queryInterface.describeTable('Subscriptions');
    if (!subs.referral) {
      await queryInterface.addColumn('Subscriptions', 'referral', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS users_referral_code');
    const users = await queryInterface.describeTable('Users');
    if (users.referralCode) await queryInterface.removeColumn('Users', 'referralCode');
    const subs = await queryInterface.describeTable('Subscriptions');
    if (subs.referral) await queryInterface.removeColumn('Subscriptions', 'referral');
  },
};
