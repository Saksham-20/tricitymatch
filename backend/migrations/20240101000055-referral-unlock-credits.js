'use strict';

/**
 * Reward for the member invite flow (Phase S already shipped the mechanism:
 * `Users.inviteToken`, `Users.invitedBy`, GET /invite/my-link, GET
 * /invite/:token). Until now an invite carried no reason to send one.
 *
 * Only ONE column is needed. `invitedBy` is already the referral edge, so there
 * is no second attribution column and no code to store — the member's invite
 * link is the existing opaque token.
 *
 * `pendingUnlockCredits` is a holding balance. Unlock accounting lives on the
 * Subscription row (`contactUnlocksAllowed`), which is what
 * `checkContactUnlockLimit` reads, and a free member has no such row — so a
 * credit earned before subscribing has nowhere to land. It waits here and is
 * moved onto the subscription the moment one becomes active, keeping exactly
 * one place that decides how many unlocks a member has.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Users');
    if (!table.pendingUnlockCredits) {
      await queryInterface.addColumn('Users', 'pendingUnlockCredits', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Users');
    if (table.pendingUnlockCredits) {
      await queryInterface.removeColumn('Users', 'pendingUnlockCredits');
    }
  },
};
