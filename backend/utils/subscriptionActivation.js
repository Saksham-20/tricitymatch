'use strict';

const { Subscription, User, MarketingLead } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { UNLIMITED_PLANS } = require('../constants/plans');
const { applyPendingCredits } = require('./inviteReward');
const { getPlanDetails } = require('./razorpay');
const { log, logAudit } = require('../middlewares/logger');
const { settleReferral } = require('./referral');
const { termEndDate } = require('./planTerm');


/**
 * The terms to activate a pending order with: the snapshot taken at
 * create-order when there is one (the buyer paid for THOSE terms), otherwise
 * the live plan — orders opened before the snapshot existed behave as before.
 * `contactUnlocks: null` means unlimited, so presence is checked by key.
 */
function termsForActivation(subscription) {
  const live = getPlanDetails(subscription.planType);
  if (!live) return null;
  const t = subscription.orderTerms;
  if (!t || typeof t !== 'object') return live;
  const duration = Number(t.duration);
  return {
    ...live,
    duration: Number.isFinite(duration) && duration > 0 ? duration : live.duration,
    contactUnlocks: Object.prototype.hasOwnProperty.call(t, 'contactUnlocks')
      ? t.contactUnlocks
      : live.contactUnlocks,
    // The fixed launch end the buyer was shown at checkout (null = none).
    // Orders snapshotted before this field existed follow the live plan.
    endsOn: Object.prototype.hasOwnProperty.call(t, 'endsOn') ? t.endsOn : (live.endsOn || null),
  };
}

/**
 * Mark the referring rep's lead as paid. ONE helper for every activation leg
 * (browser verify, webhook/reconciler, Google Play): when only the browser leg
 * wrote it, a webhook-won activation left the lead unpaid and the rep's
 * dashboards disagreed with their report. Never throws — a lead write must not
 * unwind a payment that has already been taken.
 */
async function markLeadPaid(subscription) {
  try {
    if (!subscription || !subscription.razorpayPaymentId) return;
    const lead = await MarketingLead.findOne({ where: { convertedUserId: subscription.userId } });
    if (!lead) return;
    lead.paymentStatus = 'paid';
    lead.amountPaid = subscription.amount;
    lead.paymentId = subscription.razorpayPaymentId;
    lead.status = 'converted';
    await lead.save();
  } catch (err) {
    log.warn('Marketing lead update failed (payment unaffected)', {
      subscriptionId: subscription && subscription.id, error: err.message,
    });
  }
}

/**
 * Activate the subscription for a CAPTURED Razorpay payment. Shared by the
 * webhook (`payment.captured`) and the stale-order reconciler
 * (utils/paymentReconcile.js) so the two legs of the same activation cannot
 * drift. Idempotent: an order that is already active is a no-op.
 */
async function activateCapturedPayment(order_id, payment_id) {
  let activatedWithReferral = null;
  let activatedSub = null;
  await sequelize.transaction(async (t) => {
    // Check idempotency first
    const existingActive = await Subscription.findOne({
      where: { 
        razorpayOrderId: order_id,
        status: 'active'
      },
      transaction: t
    });

    if (existingActive) {
      log.info('Webhook: Payment already processed', { orderId: order_id });
      return;
    }

    const subscription = await Subscription.findOne({
      where: { razorpayOrderId: order_id },
      transaction: t,
      lock: true
    });

    // A closed-without-payment order is revivable for the same reason as in
    // verifyPayment: a captured payment is money taken, whatever the popup
    // or the sweeper did to the row beforehand.
    const activatable = subscription
      && (subscription.status === 'pending'
        || (subscription.status === 'cancelled' && !subscription.razorpayPaymentId));
    if (activatable) {
      const planDetails = termsForActivation(subscription);
      if (!planDetails) {
        log.warn('Webhook: unknown planType, skipping activation', { planType: subscription.planType, orderId: order_id });
        return;
      }
      const now = new Date();
      const endDate = termEndDate(now, planDetails);

      subscription.razorpayPaymentId = payment_id;
      subscription.status = 'active';
      subscription.startDate = now;
      subscription.endDate = endDate;
      subscription.contactUnlocksAllowed = planDetails.contactUnlocks;
      subscription.contactUnlocksUsed = 0;
      await subscription.save({ transaction: t });

      // Same as verifyPayment — this is the fallback leg of the SAME
      // activation, so it has to apply pending credits too or which leg ran
      // would decide whether a member got their invite rewards.
      await applyPendingCredits(subscription.userId, subscription, t);

      // Supersede every OTHER pending-or-active row, exactly as
      // `verifyPayment` does. The webhook is the FALLBACK leg — it runs when
      // the browser never came back from checkout — and on an upgrade the
      // member still holds the plan they are upgrading from. Without this the
      // user ends up with two rows marked 'active': `requirePremium` picks
      // one arbitrarily (no ORDER BY), so contact-unlock quota is consumed
      // from whichever row the query happened to return and
      // `my-subscription` can report the older, cheaper plan.
      await Subscription.update(
        { status: 'cancelled' },
        {
          where: {
            userId: subscription.userId,
            status: { [Op.in]: ['pending', 'active'] },
            id: { [Op.ne]: subscription.id },
          },
          transaction: t,
        }
      );

      // Unlimited plans (VIP / NRI): activate profile boost via webhook too
      if (UNLIMITED_PLANS.includes(subscription.planType)) {
        await User.update(
          { isBoosted: true, boostExpiresAt: endDate },
          { where: { id: subscription.userId }, transaction: t }
        );
      }

      if (subscription.referral) activatedWithReferral = subscription.id;
      activatedSub = subscription;

      logAudit('subscription_activated_webhook', subscription.userId, {
        subscriptionId: subscription.id,
        orderId: order_id,
        paymentId: payment_id
      });

      log.info('Subscription activated via webhook', { 
        subscriptionId: subscription.id,
        userId: subscription.userId
      });
    }
  });

  // After the commit: a reward that fails must not unwind a taken payment.
  if (activatedWithReferral) await settleReferral(activatedWithReferral);
  if (activatedSub) await markLeadPaid(activatedSub);
}

module.exports = { activateCapturedPayment, markLeadPaid, termsForActivation };
