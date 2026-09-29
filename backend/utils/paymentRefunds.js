'use strict';

/**
 * Refunds and disputes against a subscription payment (audit P0-12).
 *
 * One code path for every source of a refund — the Razorpay webhook
 * (`refund.processed`, `payment.dispute.*`) and the admin refund action — and
 * idempotent per Razorpay refund id, so a redelivered webhook (or the webhook
 * arriving after the admin action already recorded it) changes nothing.
 *
 * A FULL refund, or a dispute lost, ends the plan: status -> 'cancelled' (the
 * existing enum value every entitlement and revenue read already excludes),
 * profile boost withdrawn, the marketing lead's paid state reversed. A PARTIAL
 * refund keeps the plan and only nets the money.
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Subscription, User, MarketingLead } = require('../models');
const { UNLIMITED_PLANS } = require('../constants/plans');
const { log, logAudit } = require('../middlewares/logger');
const { notify } = require('./notifyUser');

const rupees = (paise) => Math.round(Number(paise)) / 100;

/** Withdraw the plan and everything hanging off it. Runs inside `t`. */
const endPlan = async (sub, t, reason) => {
  const now = new Date();
  const wasLive = sub.status === 'active';
  sub.status = 'cancelled';
  if (!sub.endDate || new Date(sub.endDate) > now) sub.endDate = now;
  sub.refundedAt = sub.refundedAt || now;

  if (wasLive && UNLIMITED_PLANS.includes(sub.planType)) {
    // Only if nothing else keeps them boosted (another live unlimited plan).
    const other = await Subscription.count({
      where: {
        userId: sub.userId, status: 'active', id: { [Op.ne]: sub.id },
        planType: { [Op.in]: UNLIMITED_PLANS },
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: now } }],
      },
      transaction: t,
    });
    if (!other) {
      await User.update({ isBoosted: false, boostExpiresAt: null }, { where: { id: sub.userId }, transaction: t });
    }
  }

  const lead = await MarketingLead.findOne({ where: { convertedUserId: sub.userId }, transaction: t });
  if (lead && lead.paymentId === sub.razorpayPaymentId) {
    lead.paymentStatus = 'none';
    lead.amountPaid = null;
    await lead.save({ transaction: t });
  }
  logAudit('subscription_plan_ended_by_refund', sub.userId, { subscriptionId: sub.id, reason });
};

/**
 * @param {object} p
 * @param {string} p.paymentId  Razorpay payment id the refund is against
 * @param {string} p.refundId   Razorpay refund id (idempotency key)
 * @param {number} p.amountPaise
 * @param {string} p.source     'webhook' | 'admin'
 * @returns {Promise<{matched:boolean, duplicate?:boolean, full?:boolean, subscriptionId?:string}>}
 */
const recordRefund = async ({ paymentId, refundId, amountPaise, source }) => {
  if (!paymentId || !refundId) return { matched: false };

  const outcome = await sequelize.transaction(async (t) => {
    const sub = await Subscription.findOne({ where: { razorpayPaymentId: paymentId }, transaction: t, lock: true });
    if (!sub) return { matched: false };

    const refunds = Array.isArray(sub.refunds) ? sub.refunds : [];
    if (refunds.some((r) => r.id === refundId)) return { matched: true, duplicate: true, subscriptionId: sub.id };

    const paid = Number(sub.amount) || 0;
    const refunded = Math.min(paid, Number(sub.refundedAmount || 0) + rupees(amountPaise));
    sub.refunds = [...refunds, { id: refundId, amount: rupees(amountPaise), at: new Date().toISOString(), source }];
    sub.refundedAmount = refunded;

    const full = paid > 0 && refunded >= paid;
    if (full) await endPlan(sub, t, 'full_refund');
    await sub.save({ transaction: t });
    return { matched: true, full, userId: sub.userId, subscriptionId: sub.id, amount: rupees(amountPaise) };
  });

  if (outcome.matched && !outcome.duplicate) {
    logAudit('refund_recorded', null, { userId: outcome.userId, subscriptionId: outcome.subscriptionId, refundId, amountPaise, source, full: outcome.full });
    if (source === 'webhook' && outcome.userId) {
      // The admin action already tells the member; a refund raised elsewhere
      // (Razorpay dashboard) would otherwise be silent.
      await notify(outcome.userId, 'system', 'Refund processed',
        `A refund of ₹${outcome.amount.toFixed(2)} has been processed to your original payment method. It usually takes five to seven working days to appear.`
      ).catch((err) => log.error('Refund notification failed', { error: err.message }));
    }
  } else if (!outcome.matched) {
    log.warn('Refund event for a payment we do not hold as a subscription', { paymentId, refundId });
  }
  return outcome;
};

/**
 * Dispute lifecycle. `lost` is treated as a full refund taken by the bank: the
 * plan ends. `created` only flags (the member keeps access while it is open —
 * many disputes are resolved for the merchant), and a human is told via the
 * audit log.
 */
const recordDispute = async ({ paymentId, disputeId, status }) => {
  if (!paymentId) return { matched: false };
  const mapped = ['open', 'won', 'lost', 'closed'].includes(status) ? status : 'open';

  return sequelize.transaction(async (t) => {
    const sub = await Subscription.findOne({ where: { razorpayPaymentId: paymentId }, transaction: t, lock: true });
    if (!sub) return { matched: false };

    sub.disputeStatus = mapped;
    if (mapped === 'open' && !sub.disputedAt) sub.disputedAt = new Date();
    if (mapped === 'lost') {
      sub.refundedAmount = Number(sub.amount) || 0;
      await endPlan(sub, t, 'dispute_lost');
    }
    await sub.save({ transaction: t });
    logAudit(`payment_dispute_${mapped}`, sub.userId, { subscriptionId: sub.id, disputeId, paymentId });
    return { matched: true, subscriptionId: sub.id, status: mapped };
  });
};

module.exports = { recordRefund, recordDispute };
