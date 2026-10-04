'use strict';

/**
 * Admin-editable payout rules (AppSettings key `marketing_payout_settings`).
 *
 *   holdDays   commission becomes payable this many days after the member's
 *              payment, so a refunded purchase never reaches the rep's payable
 *              balance. Matches the 7-day window in the Refund Policy.
 *   minPayout  prepare-payouts skips reps with less than this payable (₹), so a
 *              ₹40 balance does not cost a bank transfer.
 *   tdsRate    percent withheld at source on each payout (0 = off). Whether and
 *              at what rate to deduct is a tax call for the owner's CA; this
 *              only applies the number they give.
 *
 * Every failure falls back to the defaults rather than throwing: the settings
 * only shape when money is payable, and a stale default is safer than a 500.
 */

const { log } = require('../middlewares/logger');

const SETTINGS_KEY = 'marketing_payout_settings';
const CACHE_TTL_MS = 30 * 1000;
const DEFAULTS = { holdDays: 7, minPayout: 500, tdsRate: 0 };

class PayoutSettingsError extends Error {}

let cached = null;
let cachedAt = 0;

const normalise = (blob) => {
  const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : d);
  return {
    holdDays: Math.round(num(blob?.holdDays, 0, 90, DEFAULTS.holdDays)),
    minPayout: num(blob?.minPayout, 0, 100000, DEFAULTS.minPayout),
    tdsRate: Math.round(num(blob?.tdsRate, 0, 30, DEFAULTS.tdsRate) * 100) / 100,
    updatedAt: blob?.updatedAt || null,
  };
};

const getPayoutSettings = async () => {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const { AppSetting } = require('../models');
    const row = await AppSetting.findByPk(SETTINGS_KEY);
    cached = normalise(row ? row.value : null);
  } catch (err) {
    log.warn('Payout settings load failed; using defaults', { error: err.message });
    cached = normalise(null);
  }
  cachedAt = now;
  return cached;
};

const savePayoutSettings = async (input = {}, adminId = null) => {
  const current = await getPayoutSettings();
  const next = { ...current };
  const field = (name, lo, hi, label) => {
    if (input[name] === undefined) return;
    const n = Number(input[name]);
    if (!Number.isFinite(n) || n < lo || n > hi) throw new PayoutSettingsError(`${label} must be between ${lo} and ${hi}`);
    next[name] = n;
  };
  field('holdDays', 0, 90, 'Hold period (days)');
  field('minPayout', 0, 100000, 'Minimum payout (₹)');
  field('tdsRate', 0, 30, 'TDS rate (%)');
  next.holdDays = Math.round(next.holdDays);
  next.tdsRate = Math.round(next.tdsRate * 100) / 100;
  next.updatedAt = new Date().toISOString();

  const { AppSetting } = require('../models');
  await AppSetting.upsert({ key: SETTINGS_KEY, value: next, updatedBy: adminId || null });
  cached = next;
  cachedAt = Date.now();
  return next;
};

const __resetForTests = () => { cached = null; cachedAt = 0; };

module.exports = { DEFAULTS, PayoutSettingsError, getPayoutSettings, savePayoutSettings, __resetForTests };
