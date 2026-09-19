'use strict';

/**
 * Lifecycle mail: the handful of mails the platform sends on its own
 * initiative around a purchase and around an unfinished profile.
 *
 * Extracted from queue.js so the jobs can be unit-tested without Redis — the
 * dev stack has none, so a job that lives only inside a Bull closure is one
 * nobody can exercise until production runs it against real members.
 *
 * ── The rules this file enforces ─────────────────────────────────────────
 *  • A mail is sent at most once per (row, kind). The ledger is the
 *    `lifecycleMail` JSONB on the Subscription / User. (It used to be undeclared
 *    on both models, so every write to it was silently dropped and one
 *    abandoned order was mailed every hour for days. See
 *    tests/unit/lifecycleLedger.test.js.)
 *  • Nothing leaves outside 10:00–22:00 IST, and marketing-style mail goes at a
 *    per-member slot inside that window rather than all at one minute.
 *  • The ledger is CLAIMED before the send and released if the send fails, so
 *    a ledger write that cannot be made means no mail, never a repeat mail.
 *  • Two NUDGES (checkout follow-up, photo nudge, win-back) to the same member
 *    are at least CADENCE.memberGapMs apart. NOTICES — a payment problem, a
 *    renewal date, an expiry — are exempt: they say something true about the
 *    member's own money or plan, once per subscription, and are not asking for
 *    anything. They still count toward the gap, so a nudge never lands hard on
 *    the heels of one.
 *  • Cancelling a checkout leaves NOTHING pending. A pending order means one
 *    thing only: money may have moved, or a payment attempt failed.
 *  • There is no "you left something in your cart" mail. Closing the payment
 *    popup earns at most ONE calm follow-up, a day or more later, and never
 *    more than once a month per member.
 */

const { Op, literal } = require('sequelize');
const { log } = require('../middlewares/logger');
const { HOUR_MS, DAY_MS, inSendWindow, isDue, jitterHours } = require('./lifecycleWindow');

const CADENCE = {
  // Minimum spacing between any two NUDGES to one member.
  memberGapMs: 7 * DAY_MS,

  // A failed payment gets a few minutes' grace: Razorpay's own checkout lets
  // the member retry in place, and a "your payment failed" mail that lands
  // while they are mid-retry is noise.
  paymentFailedWaitMs: 15 * 60 * 1000,

  // An order with no signal at all (tab closed, no dismiss event) is treated as
  // cancelled after this long. A late `payment.captured` webhook can still
  // revive it — see subscriptionController.
  staleOrderMs: 2 * HOUR_MS,
  // An order with a failed attempt stays pending this long (the member may
  // still retry it), then is closed.
  failedOrderTtlMs: 7 * DAY_MS,
  // Only a decision made recently is worth one follow-up.
  followUpEligibleMs: 2 * DAY_MS,

  // The single follow-up after a cancelled checkout: 24h + 0–20h after the
  // cancel, never later than 72h, and once per member per 30 days.
  followUpMinHours: 24,
  followUpJitterHours: 20,
  followUpMaxAgeMs: 3 * DAY_MS,
  followUpCooldownMs: 30 * DAY_MS,

  // Photo nudge: at most two, ever. First one 1–3 days after signup, second
  // 7–10 days after the first.
  photoFirstMinHours: 24,
  photoFirstMaxHours: 72,
  photoSecondMinDays: 7,
  photoSecondMaxDays: 10,
};

// Hard ceiling per stage per run. A lifecycle job with no cap is one bad query
// away from mailing the entire table in a single pass — which is how a batch
// run burns a provider's daily quota and takes OTP mail down with it.
const BATCH = 100;

const ms = (value) => new Date(value).getTime();

// `deliver` returns {success:false} rather than throwing when no provider is
// configured, so marking on a bare call would silently burn the one send this
// member ever gets. Only a real delivery counts.
const delivered = (result) => !result || result.success !== false;

const memberQuiet = (user, nowMs) => {
  const last = user?.lifecycleMail?.lastSentAt;
  return !last || nowMs - ms(last) >= CADENCE.memberGapMs;
};

/**
 * Close pending orders nobody is going to finish. Runs at any hour and sends
 * nothing — it is housekeeping, so "pending" only ever means an order that is
 * genuinely in flight or genuinely failed.
 */
const sweepPendingOrders = async (now = new Date()) => {
  const { Subscription } = require('../models');
  const nowMs = now.getTime();

  const rows = await Subscription.findAll({
    where: {
      status: 'pending',
      razorpayPaymentId: null,
      createdAt: { [Op.lt]: new Date(nowMs - CADENCE.staleOrderMs) },
    },
    order: [['createdAt', 'ASC']],
    limit: 500,
  });

  let swept = 0;
  for (const sub of rows) {
    const ledger = sub.lifecycleMail || {};
    const ageMs = nowMs - ms(sub.createdAt);
    // A failed attempt keeps the row pending while the member can still retry.
    if (ledger.paymentFailedAt && ageMs < CADENCE.failedOrderTtlMs) continue;

    // Conditional update: if a payment landed between the read and now, the
    // row is no longer pending and this must not clobber it.
    const followUpWorthwhile = !ledger.paymentFailedAt && ageMs < CADENCE.followUpEligibleMs;
    const [changed] = await Subscription.update(
      {
        status: 'cancelled',
        lifecycleMail: followUpWorthwhile ? { ...ledger, cancelledAt: now.toISOString() } : ledger,
      },
      { where: { id: sub.id, status: 'pending', razorpayPaymentId: null } }
    );
    swept += changed;
  }
  return swept;
};

const runSubscriptionLifecycle = async (now = new Date()) => {
  const { Subscription, User, Profile } = require('../models');
  const email = require('./email');
  const { getPlanDetails } = require('./razorpay');
  const { PAID_PLANS, PURCHASABLE_PLANS } = require('../constants/plans');

  const nowMs = now.getTime();
  const counts = { swept: 0, paymentFailed: 0, followUp: 0, renewal: 0, expired: 0, winback: 0 };

  counts.swept = await sweepPendingOrders(now);

  if (!inSendWindow(now)) {
    log.info('Subscription lifecycle: outside send window, nothing mailed', counts);
    return counts;
  }

  const withUser = {
    model: User,
    attributes: ['id', 'email', 'lifecycleMail'],
    include: [{ model: Profile, attributes: ['firstName'] }],
  };
  const nameOf = (sub) => sub.User?.Profile?.firstName || 'there';
  const labelOf = (planType) => getPlanDetails(planType)?.name || planType;

  // Members already mailed by an earlier stage of THIS run. Two rows for one
  // member (two cancelled orders, say) load two separate User instances, each
  // with a stale ledger, so the per-member gap alone cannot stop a double send.
  const mailedThisRun = new Set();

  const stampMember = (user, extra = {}) =>
    user.update({ lifecycleMail: { ...(user.lifecycleMail || {}), lastSentAt: now.toISOString(), ...extra } });

  const holdsPaidPlan = async (userId) =>
    (await Subscription.count({
      where: { userId, status: 'active', planType: { [Op.in]: PURCHASABLE_PLANS }, endDate: { [Op.gt]: now } },
    })) > 0;

  // One place for the checks every stage shares. A NOTICE skips the nudge gap
  // (see the header); a nudge does not.
  const mayMail = (sub, { notice = false } = {}) => {
    const user = sub.User;
    if (!user?.email || mailedThisRun.has(user.id)) return false;
    return notice || memberQuiet(user, nowMs);
  };

  // Claim first, send second. If the claim cannot be written nothing is sent —
  // the failure mode of a broken ledger is silence, not a mail every half hour.
  // If the send then fails, the claim is released so the member still gets it
  // on a later tick.
  const dispatch = async (sub, key, send, memberExtra = {}) => {
    const before = sub.lifecycleMail || {};
    try {
      await sub.update({ lifecycleMail: { ...before, [key]: now.toISOString() } });
    } catch (err) {
      log.error('Lifecycle ledger write failed — not sending', { kind: key, subscriptionId: sub.id, error: err.message });
      return false;
    }
    try {
      const result = await send();
      if (!delivered(result)) {
        await sub.update({ lifecycleMail: before }).catch(() => null);
        return false;
      }
    } catch (err) {
      log.warn('Lifecycle mail failed', { kind: key, subscriptionId: sub.id, error: err.message });
      await sub.update({ lifecycleMail: before }).catch(() => null);
      return false;
    }
    mailedThisRun.add(sub.User.id);
    // Best effort: the row's own claim already prevents a repeat.
    await stampMember(sub.User, memberExtra).catch((err) =>
      log.warn('Member ledger stamp failed', { userId: sub.User.id, error: err.message }));
    return true;
  };

  // 1. Payment problem — the one mail that is about the member's money rather
  //    than our wish to sell. A payment attempt failed and the order is still
  //    open. Says plainly what happened to the money and how to get help.
  //    Sent within the day-time window only, once per order.
  const failedOrders = await Subscription.findAll({
    where: {
      status: 'pending',
      razorpayPaymentId: null,
      createdAt: { [Op.gt]: new Date(nowMs - CADENCE.failedOrderTtlMs) },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of failedOrders) {
    const ledger = sub.lifecycleMail || {};
    if (!ledger.paymentFailedAt || ledger.paymentFailed) continue;
    if (nowMs - ms(ledger.paymentFailedAt) < CADENCE.paymentFailedWaitMs) continue;
    if (!mayMail(sub, { notice: true })) continue;
    if (await holdsPaidPlan(sub.userId)) continue;
    if (await dispatch(sub, 'paymentFailed', () =>
      email.sendPaymentFailed(sub.User.email, nameOf(sub), labelOf(sub.planType), sub.amount))) {
      counts.paymentFailed += 1;
    }
  }

  // 2. Closed the payment popup. One calm follow-up, a day or more later, at
  //    the member's own slot; never again for 30 days; never if they have since
  //    bought, or are visibly trying again (a newer pending order).
  const cancelledOrders = await Subscription.findAll({
    where: {
      status: 'cancelled',
      razorpayPaymentId: null,
      createdAt: { [Op.gt]: new Date(nowMs - 7 * DAY_MS) },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of cancelledOrders) {
    const ledger = sub.lifecycleMail || {};
    if (!ledger.cancelledAt || ledger.checkoutFollowUp) continue;
    const ageMs = nowMs - ms(ledger.cancelledAt);
    const waitMs = (CADENCE.followUpMinHours + jitterHours(sub.id, 0, CADENCE.followUpJitterHours)) * HOUR_MS;
    if (ageMs < waitMs || ageMs > CADENCE.followUpMaxAgeMs) continue;
    if (!isDue(`${sub.userId}:checkoutFollowUp`, now)) continue;
    if (!mayMail(sub)) continue;
    const lastFollowUp = sub.User.lifecycleMail?.checkoutFollowUpAt;
    if (lastFollowUp && nowMs - ms(lastFollowUp) < CADENCE.followUpCooldownMs) continue;
    if (await holdsPaidPlan(sub.userId)) continue;
    const retrying = await Subscription.count({
      where: { userId: sub.userId, status: 'pending', createdAt: { [Op.gt]: sub.createdAt } },
    });
    if (retrying > 0) continue;
    if (await dispatch(sub, 'checkoutFollowUp',
      () => email.sendCheckoutFollowUp(sub.User.email, nameOf(sub), labelOf(sub.planType)),
      { checkoutFollowUpAt: now.toISOString() })) {
      counts.followUp += 1;
    }
  }

  // 3. Renewal notice — seven days out, once per subscription.
  const endingSoon = await Subscription.findAll({
    where: {
      status: 'active',
      planType: { [Op.in]: PAID_PLANS },
      endDate: { [Op.gt]: now, [Op.lt]: new Date(nowMs + 7 * DAY_MS) },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of endingSoon) {
    if ((sub.lifecycleMail || {}).renewal) continue;
    if (!isDue(`${sub.id}:renewal`, now) || !mayMail(sub, { notice: true })) continue;
    const daysLeft = Math.max(1, Math.ceil((ms(sub.endDate) - nowMs) / DAY_MS));
    if (await dispatch(sub, 'renewal', () => email.sendRenewalReminder(
      sub.User.email, nameOf(sub), labelOf(sub.planType),
      new Date(sub.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      daysLeft
    ))) {
      counts.renewal += 1;
    }
  }

  // 4. Just expired. The lookback is 36h, not 24: the mail only goes in the
  //    day-time window, so a plan that lapses at 10:05 has to survive until
  //    the next morning's slot.
  const justExpired = await Subscription.findAll({
    where: {
      status: 'expired',
      planType: { [Op.in]: PAID_PLANS },
      endDate: { [Op.gt]: new Date(nowMs - 36 * HOUR_MS), [Op.lt]: now },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of justExpired) {
    if ((sub.lifecycleMail || {}).expired) continue;
    if (!isDue(`${sub.id}:expired`, now) || !mayMail(sub, { notice: true })) continue;
    if (await dispatch(sub, 'expired', () => email.sendMembershipExpired(sub.User.email, nameOf(sub), labelOf(sub.planType)))) {
      counts.expired += 1;
    }
  }

  // 5. Win-back a fortnight later — but only when there is something real to
  //    come back for. A zero count skips the send AND the mark.
  const lapsed = await Subscription.findAll({
    where: {
      status: 'expired',
      planType: { [Op.in]: PAID_PLANS },
      endDate: { [Op.gt]: new Date(nowMs - 21 * DAY_MS), [Op.lt]: new Date(nowMs - 14 * DAY_MS) },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of lapsed) {
    if ((sub.lifecycleMail || {}).winback) continue;
    if (!isDue(`${sub.id}:winback`, now) || !mayMail(sub)) continue;
    const newProfiles = await Profile.count({ where: { isActive: true, createdAt: { [Op.gt]: sub.endDate } } });
    if (newProfiles < 1) continue;
    if (await dispatch(sub, 'winback', () => email.sendWinBack(sub.User.email, nameOf(sub), newProfiles))) {
      counts.winback += 1;
    }
  }

  log.info('Subscription lifecycle mail sent', counts);
  return counts;
};

/**
 * "Your profile has no photo." At most two mails a member will ever get from
 * this job: the first a day or three after signup, the second a week or more
 * after that. Each goes at the member's own time of day inside the day-time
 * window — not every member at the same minute, and not every day.
 */
const runPhotoNudge = async (now = new Date()) => {
  const { User, Profile } = require('../models');
  const email = require('./email');
  const nowMs = now.getTime();

  if (!inSendWindow(now)) return { sent: 0, skipped: 'outside_window' };

  const candidates = await User.findAll({
    where: {
      status: 'active',
      createdAt: { [Op.lt]: new Date(nowMs - CADENCE.photoFirstMinHours * HOUR_MS) },
      // The ledger is filtered in SQL, not in JS: once a member has had both
      // nudges they stay a "no photo" candidate forever, and a JS-side skip
      // would let those rows fill every batch and starve everyone behind them.
      [Op.and]: [literal('"User"."lifecycleMail"->>\'photoNudge2\' IS NULL')],
    },
    include: [{
      model: Profile,
      required: true,
      // Postgres: an empty array is not NULL, so both cases have to be named.
      where: {
        onboardingComplete: true,
        [Op.or]: [{ photos: null }, { photos: { [Op.eq]: [] } }],
      },
      attributes: ['firstName', 'photos'],
    }],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });

  let sent = 0;
  for (const user of candidates) {
    if (!user.email) continue;
    const ledger = user.lifecycleMail || {};

    let key = null;
    if (!ledger.photoNudge1) {
      const waitH = CADENCE.photoFirstMinHours
        + jitterHours(`${user.id}:photoNudge1`, 0, CADENCE.photoFirstMaxHours - CADENCE.photoFirstMinHours);
      if (nowMs - ms(user.createdAt) >= waitH * HOUR_MS) key = 'photoNudge1';
    } else {
      const waitD = CADENCE.photoSecondMinDays
        + jitterHours(`${user.id}:photoNudge2`, 0, CADENCE.photoSecondMaxDays - CADENCE.photoSecondMinDays);
      if (nowMs - ms(ledger.photoNudge1) >= waitD * DAY_MS) key = 'photoNudge2';
    }
    if (!key) continue;
    if (!isDue(`${user.id}:${key}`, now) || !memberQuiet(user, nowMs)) continue;

    const claimed = { ...ledger, [key]: now.toISOString(), lastSentAt: now.toISOString() };
    try {
      await user.update({ lifecycleMail: claimed });
    } catch (err) {
      log.error('Photo nudge ledger write failed — not sending', { userId: user.id, error: err.message });
      continue;
    }
    try {
      const result = await email.sendAddPhotoNudge(user.email, user.Profile?.firstName || 'there');
      // An undelivered nudge must not consume the member's one-and-only ask.
      if (!delivered(result)) {
        await user.update({ lifecycleMail: ledger }).catch(() => null);
        continue;
      }
      sent += 1;
    } catch (err) {
      log.warn('Photo nudge failed', { userId: user.id, error: err.message });
      await user.update({ lifecycleMail: ledger }).catch(() => null);
    }
  }

  log.info('Photo nudges sent', { sent, candidates: candidates.length });
  return { sent };
};

module.exports = { CADENCE, sweepPendingOrders, runSubscriptionLifecycle, runPhotoNudge };
