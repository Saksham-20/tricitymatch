'use strict';

const { Subscription, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { UNLIMITED_PLANS } = require('../constants/plans');
const { applyPendingCredits } = require('./inviteReward');
const { getPlanDetails } = require('./razorpay');
const { log, logAudit } = require('../middlewares/logger');

/**
 * Activate the subscription for a CAPTURED Razorpay payment. Shared by the
 * webhook (`payment.captured`) and the stale-order reconciler
 * (utils/paymentReconcile.js) so the two legs of the same activation cannot
 * drift. Idempotent: an order that is already active is a no-op.
 */
async function activateCapturedPayment(order_id, payment_id) {
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
      const planDetails = getPlanDetails(subscription.planType);
      if (!planDetails) {
        log.warn('Webhook: unknown planType, skipping activation', { planType: subscription.planType, orderId: order_id });
        return;
      }
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + planDetails.duration);

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
}

module.exports = { activateCapturedPayment };
