'use strict';

/**
 * Payout ledger for a marketing rep.
 *
 * Three numbers, and the difference between them is the whole point:
 *
 *   earned      commission on every rupee the rep's members actually paid,
 *               at the CURRENT rate. Derived, so it moves if an admin changes
 *               the rate — which is exactly why it cannot also be the record of
 *               what was handed over.
 *   paidOut     sum of recorded payouts marked `paid`. A fact, never derived.
 *   pending     payouts queued but not yet sent. Counted against the balance so
 *               an admin cannot queue the same money twice while the first
 *               transfer is in flight.
 *   outstanding earned − paidOut − pending, floored at 0.
 *
 * The floor matters: after a rate cut, earned can fall below what was already
 * paid, and showing a rep "−₹400 outstanding" reads as a debt they owe. Zero is
 * the honest answer; `overpaid` carries the surplus for the admin view.
 */

const { MarketingPayout, User, Profile } = require('../models');
const { getRateForUser } = require('./marketingCommission');

const money = (v) => (v == null ? 0 : Number(v));
const round2 = (v) => Math.round(v * 100) / 100;

class PayoutValidationError extends Error {}

/**
 * The arithmetic, separated from the fetching so it can be reasoned about (and
 * tested) on its own.
 *
 * @param {number} earned            commission at the current rate
 * @param {Array<{amount:number|string, status:string}>} payouts
 */
function computeBalance(earned, payouts) {
  const e = round2(money(earned));
  let paidOut = 0;
  let pending = 0;
  for (const p of payouts || []) {
    if (p.status === 'paid') paidOut += money(p.amount);
    else pending += money(p.amount);
  }
  paidOut = round2(paidOut);
  pending = round2(pending);
  const balance = round2(e - paidOut - pending);
  return {
    earned: e,
    paidOut,
    pending,
    // Never negative: a rate cut can leave earned below what was already handed
    // over, and a negative "outstanding" reads as a debt the rep owes.
    outstanding: Math.max(0, balance),
    overpaid: balance < 0 ? Math.abs(balance) : 0,
  };
}

/**
 * @param {string} marketingUserId
 * @param {{ earnedOverride?: number }} opts  pass the report's already-computed
 *        commission to avoid recomputing the revenue rollup twice on one request
 */
async function getPayoutLedger(marketingUserId, opts = {}) {
  const [rate, payouts] = await Promise.all([
    getRateForUser(marketingUserId),
    MarketingPayout.findAll({
      where: { marketingUserId },
      include: [{
        model: User,
        as: 'RecordedBy',
        required: false,
        attributes: ['id', 'email'],
        include: [{ model: Profile, required: false, attributes: ['firstName', 'lastName'] }],
      }],
      order: [['createdAt', 'DESC']],
    }),
  ]);

  let earned;
  if (opts.earnedOverride !== undefined) {
    earned = money(opts.earnedOverride);
  } else {
    // Lazy require: marketingReport requires this module for nothing, but keep
    // the cycle impossible rather than merely unlikely.
    const { buildMarketingReport } = require('./marketingReport');
    const report = await buildMarketingReport(marketingUserId, { limit: 1 });
    earned = money(report.summary.commissionEarned);
  }

  const balances = computeBalance(earned, payouts);

  return {
    summary: {
      commissionRate: rate,
      ...balances,
      lastPaidAt: payouts.find((p) => p.status === 'paid')?.paidAt || null,
    },
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: money(p.amount),
      status: p.status,
      rateAtPayout: p.rateAtPayout == null ? null : money(p.rateAtPayout),
      method: p.method,
      reference: p.reference,
      note: p.note,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      recordedBy: p.RecordedBy
        ? ([p.RecordedBy.Profile?.firstName, p.RecordedBy.Profile?.lastName].filter(Boolean).join(' ').trim()
            || p.RecordedBy.email)
        : null,
    })),
  };
}

const VALID_METHODS = ['bank_transfer', 'upi', 'cash', 'cheque', 'other'];

/**
 * Record a payout against a rep. Admin-only; the rep never writes here.
 */
async function recordPayout(marketingUserId, input = {}, adminId = null) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PayoutValidationError('amount must be a positive number');
  }
  if (amount > 10000000) {
    throw new PayoutValidationError('amount is implausibly large');
  }

  const status = input.status === 'pending' ? 'pending' : 'paid';

  if (input.method && !VALID_METHODS.includes(input.method)) {
    throw new PayoutValidationError(`method must be one of: ${VALID_METHODS.join(', ')}`);
  }

  const ledger = await getPayoutLedger(marketingUserId);
  // Guard the typo, not the judgement call: an admin who really means to pay
  // more than is owed (a bonus, a correction) passes allowOverpay.
  if (!input.allowOverpay && round2(amount) > ledger.summary.outstanding) {
    throw new PayoutValidationError(
      `amount exceeds the outstanding balance of ₹${ledger.summary.outstanding}. `
      + 'Send allowOverpay to record it anyway.'
    );
  }

  const rate = await getRateForUser(marketingUserId);

  const payout = await MarketingPayout.create({
    marketingUserId,
    amount: round2(amount),
    status,
    rateAtPayout: rate,
    method: input.method || null,
    reference: input.reference ? String(input.reference).slice(0, 128) : null,
    note: input.note ? String(input.note).slice(0, 500) : null,
    periodStart: input.periodStart || null,
    periodEnd: input.periodEnd || null,
    paidAt: status === 'paid' ? (input.paidAt ? new Date(input.paidAt) : new Date()) : null,
    createdBy: adminId,
  });

  return payout;
}

/** Flip a queued payout to paid, or back. */
async function updatePayoutStatus(payoutId, status) {
  if (!['pending', 'paid'].includes(status)) {
    throw new PayoutValidationError('status must be pending or paid');
  }
  const payout = await MarketingPayout.findByPk(payoutId);
  if (!payout) return null;
  payout.status = status;
  payout.paidAt = status === 'paid' ? (payout.paidAt || new Date()) : null;
  await payout.save();
  return payout;
}

async function deletePayout(payoutId) {
  const payout = await MarketingPayout.findByPk(payoutId);
  if (!payout) return false;
  await payout.destroy();
  return true;
}

module.exports = {
  VALID_METHODS,
  computeBalance,
  PayoutValidationError,
  getPayoutLedger,
  recordPayout,
  updatePayoutStatus,
  deletePayout,
};
