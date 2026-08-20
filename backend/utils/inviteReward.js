'use strict';

/**
 * Invite reward — contact unlocks for both sides of a member invite.
 *
 * WHY THIS EXISTS
 * At launch the binding constraint is SUPPLY, not price: a member who pays and
 * finds four profiles does not renew, however cheap the plan was. The invite
 * mechanism already shipped (`utils/inviteToken.js`, `Users.invitedBy`) but gave
 * nobody a reason to use it. This attaches the one reward the product can give
 * away without touching cash — contact unlocks, which cost nothing until there
 * are profiles worth unlocking.
 *
 * WHERE THE ENTITLEMENT LIVES — read this before adding a second place
 * Every unlock gate reads `Subscription.contactUnlocksAllowed`
 * (`middlewares/auth.js` checkContactUnlockLimit). This module NEVER introduces
 * a parallel balance a gate has to also consult. A credit either lands on an
 * active finite subscription immediately, or it waits on
 * `Users.pendingUnlockCredits` until one exists and is then moved across. Two
 * consequences worth stating:
 *
 *   - A member on an UNLIMITED tier (contactUnlocksAllowed === null) is not
 *     credited into the row — there is no number there to add to. The credit
 *     parks as pending and applies to whatever finite plan they hold next.
 *   - Applying pending credits is idempotent by construction: the balance is
 *     zeroed in the same transaction that increments the subscription, under a
 *     row lock, so two concurrent activations cannot both spend it.
 *
 * FAILURE CONTRACT
 * `rewardInvite` never throws into its caller. It runs off the back of signup,
 * and a reward that 500s an account creation is a far worse outcome than a
 * reward that silently does not land. `applyPendingCredits` DOES throw, because
 * it runs inside the subscription transaction that must roll back with it.
 */

const { log } = require('../middlewares/logger');
const config = require('../config/env');

/** Unlocks granted to each side of an accepted invite. */
const INVITE_REWARD_UNLOCKS = () => config.limits?.inviteRewardUnlocks ?? 3;

/**
 * Move any pending credits onto a subscription that has just become active.
 * Call INSIDE the transaction that created/activated the row.
 *
 * @param {string} userId
 * @param {object} subscription  Sequelize Subscription instance, already saved
 * @param {import('sequelize').Transaction} transaction
 * @returns {Promise<number>} credits applied (0 when there were none)
 */
const applyPendingCredits = async (userId, subscription, transaction) => {
  // Unlimited plans have no counter to add to; leave the balance for the next
  // finite plan rather than silently burning it.
  if (!subscription || subscription.contactUnlocksAllowed === null) return 0;

  const { User } = require('../models');
  // Row lock: the balance is spent-and-zeroed, so two activations racing here
  // must not both read the same non-zero value.
  const user = await User.findByPk(userId, {
    attributes: ['id', 'pendingUnlockCredits'],
    transaction,
    // Optional-chained: a real Sequelize transaction always exposes LOCK, but
    // callers' test doubles do not, and a missing lock must degrade to an
    // unlocked read rather than throw inside someone else's payment transaction.
    lock: transaction?.LOCK?.UPDATE,
  });
  const pending = user?.pendingUnlockCredits || 0;
  if (pending <= 0) return 0;

  subscription.contactUnlocksAllowed += pending;
  await subscription.save({ transaction });

  user.pendingUnlockCredits = 0;
  await user.save({ transaction });

  log.info('Pending unlock credits applied', { userId, credits: pending });
  return pending;
};

/**
 * Credit one member. Lands on an active finite subscription when there is one,
 * otherwise parks as pending.
 *
 * Deliberately NOT wrapped in the caller's transaction: it is called from the
 * signup path, and an error raised inside a Postgres transaction poisons it —
 * a failed reward would then abort an otherwise-good signup at COMMIT.
 *
 * @returns {Promise<'applied'|'pending'|'failed'>}
 */
const creditUnlocks = async (userId, credits) => {
  if (!userId || !Number.isInteger(credits) || credits <= 0) return 'failed';
  const sequelize = require('../config/database');
  const { Op } = require('sequelize');
  const { Subscription, User } = require('../models');

  try {
    return await sequelize.transaction(async (t) => {
      const active = await Subscription.findOne({
        where: {
          userId,
          status: 'active',
          endDate: { [Op.gt]: new Date() },
          contactUnlocksAllowed: { [Op.ne]: null },
        },
        order: [['endDate', 'DESC']],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (active) {
        active.contactUnlocksAllowed += credits;
        await active.save({ transaction: t });
        return 'applied';
      }

      await User.increment(
        { pendingUnlockCredits: credits },
        { where: { id: userId }, transaction: t }
      );
      return 'pending';
    });
  } catch (err) {
    log.warn('Unlock credit failed', { userId, credits, error: err.message });
    return 'failed';
  }
};

/**
 * Reward both sides of an accepted invite. Called after a signup that resolved
 * an inviter. Never throws.
 *
 * @param {string} newUserId   the account that just signed up
 * @param {string} inviterId   `Users.invitedBy` — already verified active at signup
 */
const rewardInvite = async (newUserId, inviterId) => {
  const credits = INVITE_REWARD_UNLOCKS();
  if (!inviterId || !newUserId || credits <= 0) return;

  const [invitee, inviter] = await Promise.all([
    creditUnlocks(newUserId, credits),
    creditUnlocks(inviterId, credits),
  ]);

  log.info('Invite reward issued', { newUserId, inviterId, credits, invitee, inviter });

  // Tell the inviter something happened — an unlock that appears silently is an
  // unlock nobody knows to spend, and the whole point is to make inviting feel
  // worth repeating. Best-effort.
  try {
    const { notify } = require('./notifyUser');
    await notify(
      inviterId,
      'system',
      'Your invite was accepted',
      `${credits} contact unlock${credits === 1 ? '' : 's'} added to your account. Thanks for growing the community.`,
      newUserId
    );
  } catch (err) {
    log.warn('Invite reward notification failed (reward unaffected)', { inviterId, error: err.message });
  }
};

module.exports = { rewardInvite, creditUnlocks, applyPendingCredits, INVITE_REWARD_UNLOCKS };
