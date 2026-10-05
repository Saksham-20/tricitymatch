'use strict';

/**
 * Manual payout workflow for marketing reps (admin side + the rep's own details).
 *
 * The flow, deliberately without a payment API (RazorpayX charges a monthly
 * plan far above these payout sizes):
 *   1. rep saves where to be paid (+ PAN)             PUT  /api/marketing/payout-details
 *   2. admin reviews who is payable                    GET  /admin/marketing-payouts/overview
 *   3. admin prepares the batch (queues pending rows)  POST /admin/marketing-payouts/prepare
 *   4. admin downloads the bank upload file            GET  /admin/marketing-payouts/queued.csv
 *   5. admin pays from the bank, then marks paid       POST /admin/marketing-payouts/mark-paid
 *
 * Reading full destination details and exporting them are audited.
 */

const { asyncHandler, createError } = require('../middlewares/errorHandler');
const { logAudit } = require('../middlewares/logger');
const { User } = require('../models');
const { csvRow } = require('../utils/csv');
const {
  payableOverview,
  preparePayouts,
  queuedPayoutRows,
  markPaidBatch,
} = require('../utils/marketingPayouts');
const { getPayoutSettings, savePayoutSettings, PayoutSettingsError } = require('../utils/marketingPayoutSettings');
const {
  PayoutDetailsError,
  saveDetails,
  getMaskedDetails,
  getFullDetails,
} = require('../utils/payoutDetails');

// ---- rep: own details ------------------------------------------------------

exports.getMyPayoutDetails = asyncHandler(async (req, res) => {
  const details = await getMaskedDetails(req.user.id);
  res.json({ success: true, details });
});

exports.saveMyPayoutDetails = asyncHandler(async (req, res) => {
  try {
    const details = await saveDetails(req.user.id, req.body || {});
    // No values in the audit row: it records that the destination changed, which
    // is the fact an investigator needs, not the account number.
    logAudit('marketing_payout_details_changed', req.user.id, { targetUserId: req.user.id, method: details.method });
    res.json({ success: true, message: 'Payout details saved', details: await getMaskedDetails(req.user.id) });
  } catch (err) {
    if (err instanceof PayoutDetailsError) throw createError.badRequest(err.message);
    throw err;
  }
});

// ---- admin ----------------------------------------------------------------

exports.getPayoutOverview = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await payableOverview()) });
});

exports.getPayoutSettingsAdmin = asyncHandler(async (req, res) => {
  res.json({ success: true, settings: await getPayoutSettings() });
});

exports.updatePayoutSettingsAdmin = asyncHandler(async (req, res) => {
  const before = await getPayoutSettings();
  try {
    const settings = await savePayoutSettings(req.body || {}, req.user.id);
    logAudit('marketing_payout_settings_changed', req.user.id, { settings, previous: before });
    res.json({ success: true, message: 'Payout settings updated', settings });
  } catch (err) {
    if (err instanceof PayoutSettingsError) throw createError.badRequest(err.message);
    throw err;
  }
});

exports.prepareBatch = asyncHandler(async (req, res) => {
  const { created, skipped } = await preparePayouts(req.user.id, { repIds: req.body?.repIds });
  logAudit('marketing_payout_batch_prepared', req.user.id, {
    count: created.length,
    total: created.reduce((n, c) => n + c.amount, 0),
    skipped: skipped.length,
  });
  res.status(created.length ? 201 : 200).json({ success: true, created, skipped });
});

// The queued list for the admin screen: everything except the sensitive
// destination values (those only leave in the audited CSV).
exports.getQueued = asyncHandler(async (req, res) => {
  const rows = await queuedPayoutRows();
  res.json({
    success: true,
    payouts: rows.map(({ upiId, accountNumber, ifsc, pan, ...safe }) => ({
      ...safe,
      destination: safe.method === 'upi' ? 'UPI' : safe.method === 'bank' ? 'Bank account' : '—',
    })),
  });
});

// The bank upload file. Full account numbers and PANs: the read is audited.
exports.queuedCsv = asyncHandler(async (req, res) => {
  const rows = await queuedPayoutRows();
  logAudit('marketing_payout_export', req.user.id, { rows: rows.length });
  const header = [
    'Payout ID', 'Rep', 'Rep email', 'Method', 'Beneficiary name', 'UPI ID', 'Account number', 'IFSC', 'PAN',
    'Gross commission (INR)', 'TDS withheld (INR)', 'Net to transfer (INR)', 'Narration', 'Queued on', 'Check',
  ];
  const lines = [csvRow(header)];
  for (const r of rows) {
    lines.push(csvRow([
      r.payoutId, r.repName, r.repEmail, r.method, r.beneficiary, r.upiId, r.accountNumber, r.ifsc, r.pan,
      r.gross, r.tds, r.net, r.narration, new Date(r.createdAt).toISOString().slice(0, 10),
      r.detailsMissing ? 'NO PAYOUT DETAILS - do not pay' : '',
    ]));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rep-payouts-${new Date().toISOString().slice(0, 10)}.csv"`);
  // A leading byte-order mark so Excel opens the file as UTF-8 (names, rupee text).
  res.send(`${'\uFEFF'}${lines.join('\r\n')}\r\n`);
});

exports.markPaid = asyncHandler(async (req, res) => {
  const results = await markPaidBatch(req.body?.items, req.user.id);
  const ok = results.filter((r) => r.ok);
  logAudit('marketing_payout_batch_paid', req.user.id, {
    count: ok.length,
    total: ok.reduce((n, r) => n + r.amount, 0),
    failed: results.length - ok.length,
  });
  res.json({ success: true, results });
});

exports.getRepPayoutDetails = asyncHandler(async (req, res) => {
  const rep = await User.findByPk(req.params.userId, { attributes: ['id', 'role'] });
  if (!rep || !['marketing', 'marketing_manager'].includes(rep.role)) throw createError.notFound('Marketing user not found');
  const details = await getFullDetails(rep.id);
  logAudit('marketing_payout_details_read', req.user.id, { targetUserId: rep.id });
  res.json({ success: true, details });
});
