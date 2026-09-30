'use strict';

/**
 * Stale-order reconciler (audit P0-12).
 *
 * A captured payment activates a plan through two legs: the browser's
 * verify-payment call and the Razorpay webhook. If BOTH fail (tab closed on the
 * bank page, webhook endpoint down or mis-configured for a day) the member has
 * paid and holds nothing until support notices. This asks Razorpay directly
 * about orders that have sat `pending` for a while and, where a payment was
 * captured, runs the SAME activation the webhook would.
 *
 * Bounded by design: only Subscription orders, only ones between MIN_AGE and
 * MAX_AGE old, capped per run, and it never throws (a job that dies on one bad
 * order must not stop the rest).
 */

const { Op } = require('sequelize');
const { Subscription } = require('../models');
const { log, logAudit } = require('../middlewares/logger');
const { activateCapturedPayment } = require('./subscriptionActivation');

const MIN_AGE_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const PER_RUN_LIMIT = 50;

const reconcilePendingOrders = async ({ now = new Date(), gateway } = {}) => {
  const rzp = gateway || require('./razorpay').getRazorpayInstance();
  if (!rzp || typeof rzp.orders?.fetchPayments !== 'function') return { checked: 0, activated: 0, skipped: 'gateway not configured' };

  const rows = await Subscription.findAll({
    where: {
      // `cancelled` with no payment is the closed-popup case a late capture can still revive.
      status: { [Op.in]: ['pending', 'cancelled'] },
      razorpayPaymentId: null,
      razorpayOrderId: { [Op.ne]: null },
      createdAt: { [Op.between]: [new Date(now - MAX_AGE_MS), new Date(now - MIN_AGE_MS)] },
    },
    order: [['createdAt', 'DESC']],
    limit: PER_RUN_LIMIT,
  });

  let activated = 0;
  for (const row of rows) {
    try {
      const { items = [] } = await rzp.orders.fetchPayments(row.razorpayOrderId);
      const captured = items.find((p) => p.status === 'captured');
      if (!captured) continue;
      await activateCapturedPayment(row.razorpayOrderId, captured.id);
      activated += 1;
      logAudit('subscription_reconciled', row.userId, { subscriptionId: row.id, orderId: row.razorpayOrderId, paymentId: captured.id });
    } catch (err) {
      log.error('Reconcile: order check failed', { orderId: row.razorpayOrderId, error: err.message });
    }
  }
  if (activated) log.warn('Reconciler activated plans the webhook and browser both missed', { activated });
  return { checked: rows.length, activated };
};

module.exports = { reconcilePendingOrders, MIN_AGE_MS, MAX_AGE_MS };
