'use strict';

/**
 * Search ranking weights (admin-editable) and per-profile rank breakdown.
 *
 * Search ranks by compatibility plus a few nudges (paid plan, active boost,
 * verified, has-photo). The nudges used to be numbers scattered through the
 * controller, so tuning one meant a deploy and nobody could say why a profile
 * sat where it did. They now live here, editable from the admin panel, and each
 * result carries the factors that produced its position.
 *
 * Same fail-closed shape as utils/launchOffer: reads are synchronous off an
 * in-process cache (warmed at boot, rewritten on save, revalidated every 60s);
 * any load failure or malformed blob falls back to DEFAULT_WEIGHTS.
 */

const { log } = require('../middlewares/logger');

const SETTINGS_KEY = 'ranking_weights';
const CACHE_TTL_MS = 60 * 1000;

const DEFAULT_WEIGHTS = Object.freeze({
  plans: Object.freeze({ vip: 20, nri: 20, elite: 15, premium_plus: 10, basic_premium: 5 }),
  boosted: 8,
  verified: 8,
  // Larger than any single positive nudge so a paid plan cannot out-boost it.
  noPhoto: -40,
});

const LIMITS = { plan: [0, 50], boosted: [0, 50], verified: [0, 50], noPhoto: [-100, 0] };

const FACTOR_LABELS = {
  compatibility: 'Profile match',
  plan: 'Premium member',
  boosted: 'Boosted',
  verified: 'Photo verified',
  noPhoto: 'No photo yet',
};

let cache = { weights: DEFAULT_WEIGHTS, loadedAt: 0 };

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inRange = (n, [lo, hi]) => isNum(n) && n >= lo && n <= hi;

/** Validate a candidate weights object. Returns { ok, weights } or { ok:false, error }. */
const validate = (input) => {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Weights must be an object' };
  const plans = input.plans || {};
  const out = { plans: { ...DEFAULT_WEIGHTS.plans }, boosted: DEFAULT_WEIGHTS.boosted, verified: DEFAULT_WEIGHTS.verified, noPhoto: DEFAULT_WEIGHTS.noPhoto };

  for (const key of Object.keys(plans)) {
    if (!(key in DEFAULT_WEIGHTS.plans)) return { ok: false, error: `Unknown plan "${key}"` };
    if (!inRange(plans[key], LIMITS.plan)) return { ok: false, error: `Plan weight for ${key} must be between ${LIMITS.plan[0]} and ${LIMITS.plan[1]}` };
    out.plans[key] = plans[key];
  }
  for (const key of ['boosted', 'verified', 'noPhoto']) {
    if (input[key] === undefined) continue;
    if (!inRange(input[key], LIMITS[key])) return { ok: false, error: `${key} must be between ${LIMITS[key][0]} and ${LIMITS[key][1]}` };
    out[key] = input[key];
  }
  return { ok: true, weights: out };
};

const load = async () => {
  try {
    const { AppSetting } = require('../models');
    const row = await AppSetting.findByPk(SETTINGS_KEY);
    const parsed = row ? validate(row.value) : { ok: true, weights: DEFAULT_WEIGHTS };
    cache = { weights: parsed.ok ? parsed.weights : DEFAULT_WEIGHTS, loadedAt: Date.now() };
  } catch (err) {
    log.warn('[ranking] weights load failed, using defaults', { error: err.message });
    cache = { weights: DEFAULT_WEIGHTS, loadedAt: Date.now() };
  }
  return cache.weights;
};

const initRankingWeights = () => load();

/** Synchronous read; kicks a background refresh when stale. */
const getWeights = () => {
  if (Date.now() - cache.loadedAt > CACHE_TTL_MS) {
    cache.loadedAt = Date.now(); // one refresh in flight at a time
    load().catch(() => {});
  }
  return cache.weights;
};

const saveWeights = async (input, adminId) => {
  const parsed = validate(input);
  if (!parsed.ok) {
    const err = new Error(parsed.error);
    err.statusCode = 400;
    throw err;
  }
  const { AppSetting } = require('../models');
  await AppSetting.upsert({ key: SETTINGS_KEY, value: parsed.weights, updatedBy: adminId || null });
  cache = { weights: parsed.weights, loadedAt: Date.now() };
  return parsed.weights;
};

const resetWeights = async (adminId) => saveWeights(DEFAULT_WEIGHTS, adminId);

/**
 * Score one candidate. Returns the total and the factors behind it (zero-point
 * factors are omitted, so what is listed is what moved the profile).
 */
const rankBreakdown = ({ compatibilityScore, premiumPlan, isBoosted, isVerified, hasPhoto }, weights = getWeights()) => {
  const compat = compatibilityScore || 0;
  const factors = [{ key: 'compatibility', label: FACTOR_LABELS.compatibility, points: compat }];
  const add = (key, points) => { if (points) factors.push({ key, label: FACTOR_LABELS[key], points }); };
  add('plan', premiumPlan ? (weights.plans[premiumPlan] || 0) : 0);
  add('boosted', isBoosted ? weights.boosted : 0);
  add('verified', isVerified ? weights.verified : 0);
  add('noPhoto', hasPhoto ? 0 : weights.noPhoto);
  return { total: factors.reduce((sum, f) => sum + f.points, 0), factors };
};

module.exports = {
  DEFAULT_WEIGHTS, LIMITS, FACTOR_LABELS, validate,
  initRankingWeights, getWeights, saveWeights, resetWeights, rankBreakdown,
};
