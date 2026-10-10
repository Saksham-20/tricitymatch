'use strict';

/**
 * Short-lived cache of the ORDER of a member's ranked search and suggestions.
 *
 * Ranked search (sortBy=compatibility, what the web app sends first) scores the
 * newest 500 matching profiles and then hands back one page. Doing that on every
 * page of every search made it the most expensive frequent member request. This
 * keeps the finished order for a few minutes so page 2, 3... and a repeat visit
 * only load the profiles on the page.
 *
 * What is cached is ONLY the order: a list of userIds (and the pool total). It
 * never holds a profile, a photo or a contact detail, and it is never served on
 * its own: the controller reloads the page's profiles through the same
 * visibility `where` as an uncached search (plus `userId IN (page)`), so anyone
 * who was hidden, blocked, passed on, deactivated or made staff since the list
 * was built drops out on the next request. Everything printed on a card
 * (compatibility, plan, verified, boosted, mutual, match status) is recomputed
 * per request.
 *
 * One slot per member and kind (`search:rank:v1:<userId>`): the value carries a
 * signature of everything that shapes the ranking (filters, must-haves,
 * show-passed, the member's ranking weights / experiment arm, the member's own
 * profile version, their blocks and mutual matches). A different signature is a
 * miss and the next write replaces the slot, so a member trying many filter
 * combinations still holds at most one list (about 20 KB at 500 ids) and cannot
 * push other keys (OTP codes, lockout counters) out of the evicting cache Redis.
 *
 * Every read and write fails open: a cache problem means "rank it again", never
 * an error to the member.
 */

const crypto = require('crypto');
const cache = require('./cache');
const { log } = require('../middlewares/logger');

const RANK_PREFIX = 'search:rank:v1:';
const SUGGESTIONS_PREFIX = 'search:sugg:v1:';
const RANK_TTL_SECONDS = 300;
const SUGGESTIONS_TTL_SECONDS = 600;

const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

// Only values the search builder treats exactly like an absent filter. An empty
// ARRAY is not one of them (an empty interest-tag overlap matches nobody), so
// it is kept and gets its own signature.
const isAbsent = (v) => v === undefined || v === null || v === '';

/** JSON with object keys sorted at every level, so equal values give equal text. */
const stableStringify = (value) => {
  if (value instanceof Date) return JSON.stringify(Number.isNaN(value.getTime()) ? null : value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  const text = JSON.stringify(value);
  return text === undefined ? 'null' : text;
};

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Filter set -> canonical form: absent values (undefined, null, '') dropped,
 * keys sorted, arrays sorted. Every array a filter can carry is a set (cities
 * are OR-ed, interest tags overlap, a repeated enum becomes IN), so element
 * order never changes the result. Nothing else is merged: two inputs that could
 * build different queries never share a signature.
 */
const normalizeValue = (v) => {
  if (Array.isArray(v)) {
    return v.map(normalizeValue).sort((a, b) => compareText(stableStringify(a), stableStringify(b)));
  }
  if (isPlainObject(v)) {
    const out = {};
    for (const key of Object.keys(v).sort()) out[key] = normalizeValue(v[key]);
    return out;
  }
  return v;
};

const normalizeFilters = (filters) => {
  const out = {};
  if (!isPlainObject(filters)) return out;
  for (const key of Object.keys(filters).sort()) {
    if (!isAbsent(filters[key])) out[key] = normalizeValue(filters[key]);
  }
  return out;
};

/** The member's own profile version, or null when it cannot be read (then nothing is cached). */
const profileVersion = (profile) => {
  const at = profile && profile.updatedAt;
  if (!at) return null;
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const digest = (parts) => crypto.createHash('sha256').update(stableStringify(parts)).digest('hex');

const rankingPart = (ranking) => ({
  weights: (ranking && ranking.weights) || null,
  variant: (ranking && ranking.variant) || null,
  experiment: (ranking && ranking.experiment) || null,
});

const sortedIds = (ids) => [...(ids || [])].map(String).sort();

/**
 * Signature of a ranked search, or null when it must not be cached.
 *
 * @param {object} p
 * @param {object} p.filters        the raw filter query params (page/limit excluded)
 * @param {boolean} p.mustHavesOff
 * @param {boolean} p.showPassed
 * @param {object} p.ranking        weightsFor(userId) result
 * @param {object} p.viewerProfile  the searching member's Profile row
 * @param {object} p.viewerCtx      loadViewerContext result
 */
const rankSignature = ({ filters, mustHavesOff, showPassed, ranking, viewerProfile, viewerCtx }) => {
  const version = profileVersion(viewerProfile);
  if (!version) return null;
  return digest({
    kind: 'rank',
    filters: normalizeFilters(filters),
    mustHavesOff: Boolean(mustHavesOff),
    showPassed: Boolean(showPassed),
    ranking: rankingPart(ranking),
    viewer: version,
    blocked: sortedIds(viewerCtx && viewerCtx.blockedIds),
    mutual: sortedIds(viewerCtx && viewerCtx.mutualIds),
  });
};

/** Signature of a suggestions list, or null when it must not be cached. */
const suggestionsSignature = ({ limit, viewerPaid, ranking, viewerProfile }) => {
  const version = profileVersion(viewerProfile);
  if (!version) return null;
  return digest({
    kind: 'suggestions',
    limit: Number(limit) || 0,
    viewerPaid: Boolean(viewerPaid),
    ranking: rankingPart(ranking),
    viewer: version,
  });
};

const validIds = (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string');

const read = async (key, sig) => {
  if (!sig) return null;
  try {
    const value = await cache.get(key);
    if (!value || typeof value !== 'object' || value.sig !== sig || !validIds(value.ids)) return null;
    return value;
  } catch (err) {
    log.warn('[search-cache] read failed, ranking afresh', { error: err.message });
    return null;
  }
};

const write = async (key, value, ttl) => {
  if (!value || !value.sig) return false;
  try {
    return Boolean(await cache.set(key, value, ttl));
  } catch (err) {
    log.warn('[search-cache] write failed', { error: err.message });
    return false;
  }
};

/** Cached ranked list `{ sig, ids, total }` for this signature, or null. Never throws. */
const readRanked = async (userId, sig) => {
  const value = await read(RANK_PREFIX + userId, sig);
  return value && Number.isFinite(value.total) ? value : null;
};

/** Store `{ sig, ids, total }`. Never throws; false when not stored. */
const writeRanked = (userId, value) => write(RANK_PREFIX + userId, value, RANK_TTL_SECONDS);

/** Cached suggestions order `{ sig, ids }` for this signature, or null. Never throws. */
const readSuggestions = (userId, sig) => read(SUGGESTIONS_PREFIX + userId, sig);

/** Store `{ sig, ids }`. Never throws; false when not stored. */
const writeSuggestions = (userId, value) => write(SUGGESTIONS_PREFIX + userId, value, SUGGESTIONS_TTL_SECONDS);

/** Drop both lists for a member (tests; available for future invalidation hooks). */
const clearMember = async (userId) => {
  try {
    await Promise.all([cache.del(RANK_PREFIX + userId), cache.del(SUGGESTIONS_PREFIX + userId)]);
  } catch (err) {
    log.warn('[search-cache] clear failed', { error: err.message });
  }
};

module.exports = {
  RANK_PREFIX,
  SUGGESTIONS_PREFIX,
  RANK_TTL_SECONDS,
  SUGGESTIONS_TTL_SECONDS,
  stableStringify,
  normalizeFilters,
  rankSignature,
  suggestionsSignature,
  readRanked,
  writeRanked,
  readSuggestions,
  writeSuggestions,
  clearMember,
};
