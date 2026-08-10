'use strict';

/**
 * Founding-member grant (Phase S).
 *
 * ONE place mints a `founding_premium` subscription, so every signup path
 * (email signup, Google first-time signup, guardian-created accounts — which go
 * through the same POST /auth/signup) grants the SAME bundle. Silence here means
 * inconsistent grants: some cohorts premium, some not.
 *
 * The entitlement bundle is written EXPLICITLY, never defaulted:
 *   - planType            'founding_premium'  (in PAID_PLANS → all premium gates pass)
 *   - status              'active'
 *   - startDate           now
 *   - endDate             FOUNDING_PERIOD_ENDS (cohort expires together, not
 *                         30 days after each individual signup)
 *   - contactUnlocksAllowed  FOUNDING_CONTACT_UNLOCKS (5) — **never NULL**.
 *                         NULL means UNLIMITED in `middlewares/auth.js`
 *                         (checkContactUnlockLimit), so a defaulted grant would
 *                         give every self-signup unlimited contact unlocks =
 *                         scriptable phone-number harvest.
 *   - contactUnlocksUsed  0
 *   - amount              0 (not NULL) — the admin revenue sum aggregates
 *                         `amount`, and 0 keeps founding rows revenue-neutral
 *                         while still being countable.
 *
 * It also stamps `Users.isFoundingMember = true`, because the badge must outlive
 * the row: `verifyPayment` cancels the founding subscription when the member
 * upgrades, and the whole cohort's rows expire at the deadline.
 *
 * Contract: this NEVER throws into its caller. A failed grant must not 500 a
 * signup — the account is the thing that matters; the grant is a bonus. Failures
 * are log.warn'd and the signup proceeds.
 */

const config = require('../config/env');
const { log } = require('../middlewares/logger');
const { FOUNDING_PLAN, FOUNDING_CONTACT_UNLOCKS } = require('../constants/plans');

/**
 * Grant the founding-member bundle to a freshly created user, if the founding
 * window is still open.
 *
 * @param {string} userId
 * @param {{ transaction?: import('sequelize').Transaction }} [options]
 *        Pass the signup transaction to make the grant atomic with the account.
 * @returns {Promise<boolean>} true if a grant was created, false otherwise.
 */
const grantFoundingIfOpen = async (userId, options = {}) => {
  const { transaction } = options;

  try {
    if (!userId) return false;

    // Gate 1 — the date. `isOpen()` is false when FOUNDING_PERIOD_ENDS is unset,
    // unparseable, or in the past. Unset is the default: no env, no grants.
    if (!config.founding.isOpen()) return false;

    const endDate = new Date(config.founding.endsAt);

    // Models are required lazily so this util can be unit-tested against a
    // mocked models module without dragging a live Sequelize connection in at
    // require time (matches the lazy `require('../models')` style used in
    // controllers for the same reason).
    const { Subscription, User } = require('../models');

    // Gate 2 — the member cap, when one is configured. This is a READ-THEN-INSERT
    // count with no lock, so concurrent signups can overshoot the cap by a few
    // accounts. That is ACCEPTED and deliberate: serialising every signup behind
    // a lock (or a unique counter row) to protect a soft marketing cap is a bad
    // trade. Overshoot is bounded by concurrency, not by traffic volume.
    const cap = config.founding.memberCap;
    if (cap && cap > 0) {
      const granted = await Subscription.count({
        where: { planType: FOUNDING_PLAN },
        transaction,
      });
      if (granted >= cap) return false;
    }

    await Subscription.create(
      {
        userId,
        planType: FOUNDING_PLAN,
        status: 'active',
        startDate: new Date(),
        endDate,
        // EXPLICIT. NULL here = unlimited unlocks. See the header note.
        contactUnlocksAllowed: FOUNDING_CONTACT_UNLOCKS,
        contactUnlocksUsed: 0,
        amount: 0,
        autoRenew: false,
      },
      { transaction }
    );

    await User.update(
      { isFoundingMember: true },
      { where: { id: userId }, transaction }
    );

    log.info('Founding grant issued', { userId, endDate: endDate.toISOString() });
    return true;
  } catch (error) {
    // Never escape into the signup response.
    log.warn('Founding grant failed (signup unaffected)', {
      userId,
      error: error.message,
    });
    return false;
  }
};

module.exports = { grantFoundingIfOpen };
