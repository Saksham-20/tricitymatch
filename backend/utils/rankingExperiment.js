'use strict';

/**
 * One ranking experiment at a time (audit P2).
 *
 * Ranking weights are admin-editable (utils/rankingWeights) but a change applies
 * to everyone at once, so nobody can say whether it helped. An experiment gives
 * a stable share of members a different set of weights and reports what those
 * members did afterwards.
 *
 *   config   AppSettings key `ranking_experiment`
 *            { name, enabled, sharePct, overrides, startedAt }
 *   bucket   sha256(name + ':' + userId) mod 100 — deterministic, so a member
 *            stays in the same arm for the life of the experiment and results
 *            can be recomputed later from the database alone (no exposure log).
 *   arms     `control` = the live weights; `variant` = live weights with the
 *            overrides applied, validated against the same limits.
 *
 * Fail-closed exactly like the weights: any load problem, a disabled or
 * malformed experiment, or a rejected override means everyone gets the live
 * weights. Reads are synchronous off an in-process cache (search is hot).
 *
 * Results are intention-to-treat over every active member in each arm (not only
 * those who happened to search): interests sent and mutual matches per member
 * since the experiment started. The bucket is computed in SQL with the same
 * hash so the two can never drift; a test pins that.
 */

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { log } = require('../middlewares/logger');
const rankingWeights = require('./rankingWeights');

const SETTINGS_KEY = 'ranking_experiment';
const CACHE_TTL_MS = 60 * 1000;
const MAX_SHARE = 50;

let cache = { experiment: null, loadedAt: 0 };

const NAME_RE = /^[a-z0-9][a-z0-9_-]{2,39}$/;

const bucketFor = (name, userId) => {
  const hex = crypto.createHash('sha256').update(`${name}:${userId}`).digest('hex');
  return parseInt(hex.slice(0, 8), 16) % 100;
};

/** Live weights with the overrides applied, or null if the result is not valid. */
const variantWeights = (overrides, base = rankingWeights.getWeights()) => {
  const merged = {
    plans: { ...base.plans, ...((overrides && overrides.plans) || {}) },
    boosted: base.boosted,
    verified: base.verified,
    noPhoto: base.noPhoto,
  };
  for (const key of ['boosted', 'verified', 'noPhoto']) {
    if (overrides && overrides[key] !== undefined) merged[key] = overrides[key];
  }
  const checked = rankingWeights.validate(merged);
  return checked.ok ? checked.weights : null;
};

const validate = (input) => {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Experiment must be an object' };
  const name = String(input.name || '').trim().toLowerCase();
  if (!NAME_RE.test(name)) return { ok: false, error: 'Name must be 3-40 characters: letters, digits, - or _' };
  const sharePct = Number(input.sharePct);
  if (!Number.isInteger(sharePct) || sharePct < 1 || sharePct > MAX_SHARE) {
    return { ok: false, error: `Share must be a whole number from 1 to ${MAX_SHARE}` };
  }
  const overrides = input.overrides && typeof input.overrides === 'object' ? input.overrides : {};
  const allowed = new Set(['plans', 'boosted', 'verified', 'noPhoto']);
  const unknown = Object.keys(overrides).find((k) => !allowed.has(k));
  if (unknown) return { ok: false, error: `Unknown override "${unknown}"` };
  if (Object.keys(overrides).length === 0) return { ok: false, error: 'Give the variant at least one changed weight' };
  if (!variantWeights(overrides)) return { ok: false, error: 'Those weights are outside the allowed ranges' };
  return {
    ok: true,
    experiment: {
      name,
      sharePct,
      overrides,
      enabled: input.enabled !== false,
      startedAt: input.startedAt || new Date().toISOString(),
    },
  };
};

const load = async () => {
  try {
    const { AppSetting } = require('../models');
    const row = await AppSetting.findByPk(SETTINGS_KEY);
    const parsed = row ? validate(row.value) : null;
    const exp = parsed && parsed.ok ? { ...parsed.experiment, enabled: row.value.enabled !== false } : null;
    cache = { experiment: exp, loadedAt: Date.now() };
  } catch (err) {
    log.warn('[ranking] experiment load failed, running none', { error: err.message });
    cache = { experiment: null, loadedAt: Date.now() };
  }
  return cache.experiment;
};

const initRankingExperiment = () => load();

const getExperiment = () => {
  if (Date.now() - cache.loadedAt > CACHE_TTL_MS) {
    cache.loadedAt = Date.now();
    load().catch(() => {});
  }
  return cache.experiment;
};

/**
 * The weights to rank with for this member.
 * @returns {{ weights: object, variant: 'control'|'variant', experiment: string|null }}
 */
const weightsFor = (userId) => {
  const live = rankingWeights.getWeights();
  const exp = getExperiment();
  if (!exp || !exp.enabled || !userId) return { weights: live, variant: 'control', experiment: null };
  if (bucketFor(exp.name, userId) >= exp.sharePct) return { weights: live, variant: 'control', experiment: exp.name };
  const weights = variantWeights(exp.overrides, live);
  return weights
    ? { weights, variant: 'variant', experiment: exp.name }
    : { weights: live, variant: 'control', experiment: exp.name };
};

const saveExperiment = async (input, adminId) => {
  const parsed = validate(input);
  if (!parsed.ok) {
    const err = new Error(parsed.error);
    err.statusCode = 400;
    throw err;
  }
  const { AppSetting } = require('../models');
  await AppSetting.upsert({ key: SETTINGS_KEY, value: parsed.experiment, updatedBy: adminId || null });
  cache = { experiment: parsed.experiment, loadedAt: Date.now() };
  return parsed.experiment;
};

/** Stop without deleting: everyone returns to the live weights, results stay readable. */
const stopExperiment = async (adminId) => {
  const { AppSetting } = require('../models');
  const row = await AppSetting.findByPk(SETTINGS_KEY);
  if (!row) return null;
  const value = { ...row.value, enabled: false };
  await AppSetting.upsert({ key: SETTINGS_KEY, value, updatedBy: adminId || null });
  cache = { experiment: value, loadedAt: Date.now() };
  return value;
};

/** Read the stored experiment even when stopped (for the admin screen). */
const readStored = async () => {
  const { AppSetting } = require('../models');
  const row = await AppSetting.findByPk(SETTINGS_KEY);
  return row ? row.value : null;
};

/**
 * Outcomes per arm since the experiment started, over every active member.
 * Same hash as bucketFor: sha256(name:userId), first 8 hex chars, mod 100.
 */
const results = async (exp) => {
  if (!exp) return null;
  const sequelize = require('../config/database');
  const rows = await sequelize.query(
    `WITH arm AS (
       SELECT u.id,
              CASE WHEN (('x' || substr(encode(sha256(convert_to(:name || ':' || u.id::text, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 100) < :share
                   THEN 'variant' ELSE 'control' END AS arm
       FROM "Users" u
       WHERE u.role = 'user' AND u.status = 'active'
     )
     SELECT a.arm,
            count(DISTINCT a.id)::int AS members,
            count(m.id) FILTER (WHERE m.action = 'like')::int AS "interestsSent",
            count(m.id) FILTER (WHERE m.action = 'like' AND m."isMutual" = true)::int AS "mutualMatches"
     FROM arm a
     LEFT JOIN "Matches" m ON m."userId" = a.id AND m."createdAt" >= :since
     GROUP BY a.arm`,
    { replacements: { name: exp.name, share: exp.sharePct, since: exp.startedAt }, type: QueryTypes.SELECT }
  );
  const out = { control: null, variant: null };
  for (const r of rows) {
    out[r.arm] = {
      members: r.members,
      interestsSent: r.interestsSent,
      mutualMatches: r.mutualMatches,
      interestsPerMember: r.members ? Number((r.interestsSent / r.members).toFixed(3)) : 0,
    };
  }
  return out;
};

module.exports = {
  bucketFor, variantWeights, validate, initRankingExperiment, getExperiment,
  weightsFor, saveExperiment, stopExperiment, readStored, results, MAX_SHARE,
};
