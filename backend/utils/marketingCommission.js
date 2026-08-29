'use strict';

/**
 * Marketing commission (admin-editable).
 *
 * A rep is paid a share of what the members they brought in actually paid, so
 * two things have to be true at once: the rate is the owner's lever (no
 * redeploy to change it), and the rep can see the arithmetic behind their own
 * number rather than being handed a total to trust.
 *
 * Stored as one AppSettings row (`marketing_commission`, migration 000053's
 * key/JSONB table) shaped for a per-rep override later without a second
 * migration:
 *
 *   { rate: 20, overrides: { "<marketingUserId>": 15 }, updatedAt: "..." }
 *
 * Reads are async and cached in-process for a minute; nothing in a payment
 * path depends on them, so there is no need for the synchronous gymnastics
 * `launchOffer` needs. Every failure path FALLS BACK TO THE DEFAULT RATE — a
 * commission figure that silently reads 0 because the DB hiccuped would be
 * read as "you earned nothing", which is worse than a slightly stale rate.
 */

const { log } = require('../middlewares/logger');

const SETTINGS_KEY = 'marketing_commission';
const CACHE_TTL_MS = 60 * 1000;

const DEFAULT_RATE = 20; // percent

let cached = null;
let cachedAt = 0;

class CommissionValidationError extends Error {}

const normalise = (blob) => {
  const rate = Number(blob?.rate);
  const overrides = {};
  if (blob?.overrides && typeof blob.overrides === 'object') {
    for (const [k, v] of Object.entries(blob.overrides)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 100) overrides[k] = n;
    }
  }
  return {
    rate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : DEFAULT_RATE,
    overrides,
    updatedAt: blob?.updatedAt || null,
  };
};

const load = async () => {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const { AppSetting } = require('../models');
    const row = await AppSetting.findByPk(SETTINGS_KEY);
    cached = normalise(row ? row.value : null);
  } catch (err) {
    // Fall back to the default rather than reporting zero earnings.
    log.warn('Commission settings load failed; using default rate', { error: err.message });
    cached = normalise(null);
  }
  cachedAt = now;
  return cached;
};

/** Full settings blob (admin view). */
const getCommissionSettings = async () => load();

/** The rate that applies to one rep, honouring a per-rep override. */
const getRateForUser = async (marketingUserId) => {
  const s = await load();
  const override = marketingUserId ? s.overrides[marketingUserId] : undefined;
  return Number.isFinite(override) ? override : s.rate;
};

/**
 * Commission on an amount, rounded to whole rupees.
 * Rounds half up, so a rep is never shorted by a fraction of a rupee.
 */
const commissionOn = (amount, rate) => {
  const a = Number(amount) || 0;
  const r = Number(rate) || 0;
  return Math.round((a * r) / 100);
};

/**
 * @param {{ rate?: number, overrides?: object }} input
 * @param {string} adminId
 */
const saveCommissionSettings = async (input = {}, adminId = null) => {
  const current = await load();
  const next = { ...current };

  if (input.rate !== undefined) {
    const rate = Number(input.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new CommissionValidationError('rate must be a number between 0 and 100');
    }
    // Two decimals is as fine as a payout ever needs to be, and keeps the
    // stored value from drifting into float noise.
    next.rate = Math.round(rate * 100) / 100;
  }

  if (input.overrides !== undefined) {
    if (input.overrides === null) {
      next.overrides = {};
    } else if (typeof input.overrides === 'object') {
      const overrides = {};
      for (const [k, v] of Object.entries(input.overrides)) {
        if (v === null) continue; // null clears an override
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          throw new CommissionValidationError(`override for ${k} must be between 0 and 100`);
        }
        overrides[k] = Math.round(n * 100) / 100;
      }
      next.overrides = overrides;
    } else {
      throw new CommissionValidationError('overrides must be an object');
    }
  }

  next.updatedAt = new Date().toISOString();

  const { AppSetting } = require('../models');
  await AppSetting.upsert({ key: SETTINGS_KEY, value: next, updatedBy: adminId || null });

  cached = next;
  cachedAt = Date.now();
  return next;
};

const __setCacheForTests = (value) => {
  cached = value === null ? null : normalise(value);
  cachedAt = value === null ? 0 : Date.now() + CACHE_TTL_MS * 1000;
};

module.exports = {
  DEFAULT_RATE,
  CommissionValidationError,
  getCommissionSettings,
  getRateForUser,
  commissionOn,
  saveCommissionSettings,
  __setCacheForTests,
};
