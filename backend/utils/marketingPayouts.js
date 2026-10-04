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
 *   payable     the part of outstanding whose refund window has passed
 *               (commission on payments at least `holdDays` old). This, not
 *               outstanding, is what an admin may pay out. `inHold` is the rest.
 *
 * The floor matters: after a rate cut, earned can fall below what was already
 * paid, and showing a rep "−₹400 outstanding" reads as a debt they owe. Zero is
 * the honest answer; `overpaid` carries the surplus for the admin view.
 */

const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { MarketingPayout, User, Profile } = require('../models');
const { getRateForUser, commissionOn } = require('./marketingCommission');
const { getPayoutSettings } = require('./marketingPayoutSettings');
const { getMaskedDetails, getFullDetails, changedRecently } = require('./payoutDetails');

const money = (v) => (v == null ? 0 : Number(v));
const round2 = (v) => Math.round(v * 100) / 100;

class PayoutValidationError extends Error {}

/**
 * The arithmetic, separated from the fetching so it can be reasoned about (and
 * tested) on its own.
 *
 * @param {number} earned            commission at the current rate
 * @param {Array<{amount:number|string, status:string}>} payouts
 * @param {number} [earnedClear]     the part of `earned` past the refund window;
 *                                   omit it and everything is treated as clear
 */
function computeBalance(earned, payouts, earnedClear) {
  const e = round2(money(earned));
  let paidOut = 0;
  let pending = 0;
  for (const p of payouts || []) {
    // A voided payout is kept as a record but never counted.
    if (p.voidedAt) continue;
    if (p.status === 'paid') paidOut += money(p.amount);
    else pending += money(p.amount);
  }
  paidOut = round2(paidOut);
  pending = round2(pending);
  const balance = round2(e - paidOut - pending);
  const outstanding = Math.max(0, balance);
  const clear = earnedClear === undefined ? e : Math.min(round2(money(earnedClear)), e);
  // Payable is what has cleared the window, less what was already settled or
  // queued, and can never exceed outstanding.
  const payable = Math.min(outstanding, Math.max(0, round2(clear - paidOut - pending)));
  return {
    earned: e,
    paidOut,
    pending,
    // Never negative: a rate cut can leave earned below what was already handed
    // over, and a negative "outstanding" reads as a debt the rep owes.
    outstanding,
    payable,
    inHold: round2(outstanding - payable),
    overpaid: balance < 0 ? Math.abs(balance) : 0,
  };
}

/**
 * @param {string} marketingUserId
 * @param {{ earnedOverride?: number, transaction?: object }} opts
 *        earnedOverride: pass the report's already-computed commission to avoid
 *        recomputing the revenue rollup twice on one request.
 *        transaction: read the payouts inside the caller's transaction (the
 *        payout write takes a row lock first, then reads the ledger under it).
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
      transaction: opts.transaction,
    }),
  ]);

  // Lazy require: marketingReport requires this module for nothing, but keep
  // the cycle impossible rather than merely unlikely.
  const { buildMarketingReport, getRepRevenueSplit } = require('./marketingReport');
  const settings = await getPayoutSettings();

  let earned;
  if (opts.earnedOverride !== undefined) {
    earned = money(opts.earnedOverride);
  } else {
    const report = await buildMarketingReport(marketingUserId, { limit: 1 });
    earned = money(report.summary.commissionEarned);
  }
  const split = await getRepRevenueSplit(marketingUserId, settings.holdDays);
  const earnedClear = commissionOn(split.clear, rate);

  const balances = computeBalance(earned, payouts, earnedClear);

  return {
    summary: {
      commissionRate: rate,
      holdDays: settings.holdDays,
      minPayout: settings.minPayout,
      ...balances,
      lastPaidAt: payouts.find((p) => p.status === 'paid' && !p.voidedAt)?.paidAt || null,
    },
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: money(p.amount),
      status: p.status,
      rateAtPayout: p.rateAtPayout == null ? null : money(p.rateAtPayout),
      tdsRate: p.tdsRate == null ? null : money(p.tdsRate),
      tdsAmount: money(p.tdsAmount),
      // What actually leaves the bank: gross commission less TDS withheld.
      netAmount: round2(money(p.amount) - money(p.tdsAmount)),
      method: p.method,
      reference: p.reference,
      note: p.note,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      voided: Boolean(p.voidedAt),
      voidedAt: p.voidedAt || null,
      voidReason: p.voidReason || null,
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
  // `payAllPayable` (used by the monthly prepare run) takes the amount from the
  // ledger UNDER the lock instead of trusting a figure read earlier.
  const payAll = input.payAllPayable === true;
  let amount = Number(input.amount);
  if (!payAll) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PayoutValidationError('amount must be a positive number');
    }
    if (amount > 10000000) {
      throw new PayoutValidationError('amount is implausibly large');
    }
  }

  const settings = await getPayoutSettings();
  let tdsRate = settings.tdsRate;
  if (input.tdsRate !== undefined && input.tdsRate !== null && input.tdsRate !== '') {
    tdsRate = Number(input.tdsRate);
    if (!Number.isFinite(tdsRate) || tdsRate < 0 || tdsRate > 30) {
      throw new PayoutValidationError('tdsRate must be between 0 and 30');
    }
  }

  const status = input.status === 'pending' ? 'pending' : 'paid';

  if (input.method && !VALID_METHODS.includes(input.method)) {
    throw new PayoutValidationError(`method must be one of: ${VALID_METHODS.join(', ')}`);
  }

  // One transaction that takes a lock on the REP's user row before reading the
  // ledger. Without it two concurrent requests both read the same outstanding
  // balance, both passed the guard and both inserted — the same money paid
  // twice. The second request now waits here, then reads a ledger that already
  // contains the first payout.
  return sequelize.transaction(async (t) => {
    await User.findByPk(marketingUserId, { attributes: ['id'], transaction: t, lock: t.LOCK.UPDATE });

    const ledger = await getPayoutLedger(marketingUserId, { transaction: t });
    if (payAll) {
      amount = ledger.summary.payable;
      if (!(amount > 0)) throw new PayoutValidationError('Nothing is payable yet');
    }
    // Guard the typo and the refund window, not the judgement call: an admin who
    // really means to pay early, or more than is owed (a bonus, a correction),
    // passes allowOverpay.
    if (!input.allowOverpay && round2(amount) > ledger.summary.payable) {
      const held = ledger.summary.inHold > 0
        ? ` ₹${ledger.summary.inHold} more is still inside the ${ledger.summary.holdDays}-day refund window.`
        : '';
      throw new PayoutValidationError(
        `amount exceeds the payable balance of ₹${ledger.summary.payable}.${held} `
        + 'Send allowOverpay to record it anyway.'
      );
    }

    const rate = await getRateForUser(marketingUserId);

    return MarketingPayout.create({
      marketingUserId,
      amount: round2(amount),
      status,
      rateAtPayout: rate,
      tdsRate,
      tdsAmount: round2((round2(amount) * tdsRate) / 100),
      method: input.method || null,
      reference: input.reference ? String(input.reference).slice(0, 128) : null,
      note: input.note ? String(input.note).slice(0, 500) : null,
      periodStart: input.periodStart || null,
      periodEnd: input.periodEnd || null,
      paidAt: status === 'paid' ? (input.paidAt ? new Date(input.paidAt) : new Date()) : null,
      createdBy: adminId,
    }, { transaction: t });
  });
}

/** Flip a queued payout to paid, or back. */
async function updatePayoutStatus(payoutId, status, extra = {}) {
  if (!['pending', 'paid'].includes(status)) {
    throw new PayoutValidationError('status must be pending or paid');
  }
  const payout = await MarketingPayout.findByPk(payoutId);
  if (!payout) return null;
  if (payout.voidedAt) throw new PayoutValidationError('This payout has been voided and can no longer be changed');
  payout.status = status;
  payout.paidAt = status === 'paid' ? (payout.paidAt || new Date()) : null;
  // The bank's reference (UTR) is what ties this row to the statement line.
  if (status === 'paid' && typeof extra.reference === 'string' && extra.reference.trim()) {
    payout.reference = extra.reference.trim().slice(0, 128);
  }
  await payout.save();
  return payout;
}

/**
 * Void a payout recorded in error. Never destroys the row: it is the record that
 * money left, so it stays with who voided it, when and why, and stops counting
 * toward the rep's paid-out / pending. A reason is required — "why was this
 * removed" is the question asked months later.
 *
 * @returns {Promise<object|null>} the voided payout, or null when not found
 */
async function voidPayout(payoutId, { reason, adminId = null } = {}) {
  const why = typeof reason === 'string' ? reason.trim() : '';
  if (why.length < 5) throw new PayoutValidationError('A reason (at least 5 characters) is required to void a payout');

  const payout = await MarketingPayout.findByPk(payoutId);
  if (!payout) return null;
  if (payout.voidedAt) throw new PayoutValidationError('This payout is already voided');

  payout.voidedAt = new Date();
  payout.voidedBy = adminId;
  payout.voidReason = why.slice(0, 300);
  await payout.save();
  return payout;
}

const MARKETING_ROLES = ['marketing', 'marketing_manager'];
const repName = (u) => ([u?.Profile?.firstName, u?.Profile?.lastName].filter(Boolean).join(' ').trim() || u?.email || '');

/**
 * Every rep with what is payable now and whether a monthly run would pay them.
 * `reason` says why not, so the admin never has to guess why a rep was skipped:
 * no details, details changed in the last 48h, below the minimum, nothing past
 * the refund window, or an inactive account.
 */
async function payableOverview() {
  const settings = await getPayoutSettings();
  const reps = await User.findAll({
    where: { role: { [Op.in]: MARKETING_ROLES } },
    attributes: ['id', 'email', 'status'],
    include: [{ model: Profile, required: false, attributes: ['firstName', 'lastName'] }],
    order: [['createdAt', 'ASC']],
  });

  const rows = [];
  for (const rep of reps) {
    const [ledger, details] = await Promise.all([getPayoutLedger(rep.id), getMaskedDetails(rep.id)]);
    const s = ledger.summary;
    let reason = null;
    if (rep.status !== 'active') reason = 'inactive_account';
    else if (!details) reason = 'no_details';
    else if (details.unreadable) reason = 'details_unreadable';
    else if (changedRecently(details.updatedAt)) reason = 'details_changed_recently';
    else if (!(s.payable > 0)) reason = 'nothing_payable';
    else if (s.payable < settings.minPayout) reason = 'below_minimum';
    rows.push({
      userId: rep.id,
      name: repName(rep),
      email: rep.email,
      status: rep.status,
      commissionRate: s.commissionRate,
      earned: s.earned,
      paidOut: s.paidOut,
      pending: s.pending,
      payable: s.payable,
      inHold: s.inHold,
      detailsMethod: details ? details.method : null,
      detailsUpdatedAt: details ? details.updatedAt : null,
      eligible: reason === null,
      reason,
    });
  }
  return { settings, reps: rows, totals: {
    payable: round2(rows.filter((r) => r.eligible).reduce((n, r) => n + r.payable, 0)),
    eligibleReps: rows.filter((r) => r.eligible).length,
  } };
}

/**
 * Queue a pending payout for every eligible rep (or just `repIds`), each for
 * exactly its payable balance, taken under the same row lock a manual payout
 * uses — so running this twice, or racing a manual entry, cannot pay twice.
 * Nothing is sent anywhere: the rows are the to-do list the admin pays from a
 * bank bulk upload, then marks paid with each UTR.
 */
async function preparePayouts(adminId, { repIds } = {}) {
  const overview = await payableOverview();
  const wanted = Array.isArray(repIds) && repIds.length ? new Set(repIds) : null;
  const created = [];
  const skipped = [];
  for (const rep of overview.reps) {
    if (wanted && !wanted.has(rep.userId)) continue;
    if (!rep.eligible) { skipped.push({ userId: rep.userId, name: rep.name, reason: rep.reason }); continue; }
    try {
      const payout = await recordPayout(rep.userId, {
        payAllPayable: true,
        status: 'pending',
        method: rep.detailsMethod === 'upi' ? 'upi' : 'bank_transfer',
        note: 'Commission payout (prepared batch)',
      }, adminId);
      created.push({ id: payout.id, userId: rep.userId, name: rep.name, amount: money(payout.amount), tdsAmount: money(payout.tdsAmount) });
    } catch (err) {
      if (err instanceof PayoutValidationError) skipped.push({ userId: rep.userId, name: rep.name, reason: 'changed_during_run' });
      else throw err;
    }
  }
  return { created, skipped };
}

/** Pending payouts joined with full destination details, for the bank upload file. */
async function queuedPayoutRows() {
  const payouts = await MarketingPayout.findAll({
    where: { status: 'pending', voidedAt: null },
    include: [{
      model: User, as: 'MarketingUser', attributes: ['id', 'email'],
      include: [{ model: Profile, required: false, attributes: ['firstName', 'lastName'] }],
    }],
    order: [['createdAt', 'ASC']],
  });
  const rows = [];
  for (const p of payouts) {
    const d = await getFullDetails(p.marketingUserId);
    rows.push({
      payoutId: p.id,
      repName: repName(p.MarketingUser),
      repEmail: p.MarketingUser?.email || '',
      method: d?.method || '',
      beneficiary: d?.accountHolder || repName(p.MarketingUser),
      upiId: d?.upiId || '',
      accountNumber: d?.accountNumber || '',
      ifsc: d?.ifsc || '',
      pan: d?.pan || '',
      gross: money(p.amount),
      tds: money(p.tdsAmount),
      net: round2(money(p.amount) - money(p.tdsAmount)),
      narration: `TricityMatch commission ${String(p.id).slice(0, 8)}`,
      createdAt: p.createdAt,
      detailsMissing: !d || d.unreadable === true,
    });
  }
  return rows;
}

/**
 * Mark several queued payouts paid in one go, each with its own bank reference.
 * Voided or already-paid rows are reported, never changed.
 */
async function markPaidBatch(items = [], adminId = null) {
  const results = [];
  for (const item of items) {
    const id = item && item.id;
    try {
      const before = id ? await MarketingPayout.findByPk(id) : null;
      if (!before) { results.push({ id, ok: false, reason: 'not_found' }); continue; }
      if (before.voidedAt) { results.push({ id, ok: false, reason: 'voided' }); continue; }
      if (before.status === 'paid') { results.push({ id, ok: false, reason: 'already_paid' }); continue; }
      const payout = await updatePayoutStatus(id, 'paid', { reference: item.reference });
      results.push({ id, ok: true, userId: payout.marketingUserId, amount: money(payout.amount), reference: payout.reference });
    } catch (err) {
      if (err instanceof PayoutValidationError) results.push({ id, ok: false, reason: err.message });
      else throw err;
    }
  }
  return results;
}

module.exports = {
  payableOverview,
  preparePayouts,
  queuedPayoutRows,
  markPaidBatch,
  VALID_METHODS,
  computeBalance,
  PayoutValidationError,
  getPayoutLedger,
  recordPayout,
  updatePayoutStatus,
  voidPayout,
};
