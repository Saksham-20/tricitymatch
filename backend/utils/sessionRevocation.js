'use strict';

/**
 * Makes "sign out" end ACCESS tokens too (feature interrogation AUTH-05).
 *
 * Revoking a session only revoked its refresh token; the 15-minute access JWT
 * is self-contained and kept working until it expired, so "sign out everywhere"
 * did not actually cut off a thief for up to 15 minutes. Revocation is recorded
 * in the cache with a TTL just longer than the access-token lifetime (after
 * that the JWT is dead anyway), in two shapes:
 *
 *   sess_rev:<sessionId>   one session (RefreshToken row id = the token's `sid`)
 *   sess_cut:<userId>      "every token issued before this second" (sign out
 *                          everywhere, password reset, hand-over)
 *
 * Fails OPEN on a cache read error: an unreadable cache must not sign every
 * member out, and the old behaviour (expiry within 15 minutes) is the floor.
 */

const config = require('../config/env');
const { get: cacheGet, set: cacheSet } = require('./cache');

const parseSeconds = (duration) => {
  const m = String(duration || '').match(/^(\d+)([smhd])$/);
  if (!m) return 15 * 60;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]];
};

// Longer than the access token lives, so a mark never expires before the token.
const ttlSeconds = () => parseSeconds(config.auth.jwtExpiry) + 120;

const markSessionsRevoked = async (sessionIds = []) => {
  const ids = [...new Set(sessionIds.filter(Boolean))];
  await Promise.all(ids.map((id) => cacheSet(`sess_rev:${id}`, 1, ttlSeconds()).catch(() => null)));
};

const markUserRevoked = async (userId) => {
  if (!userId) return;
  await cacheSet(`sess_cut:${userId}`, Math.floor(Date.now() / 1000), ttlSeconds()).catch(() => null);
};

/** True when this decoded access token has been revoked. */
const isAccessRevoked = async (decoded) => {
  try {
    const cutoff = decoded?.userId ? Number(await cacheGet(`sess_cut:${decoded.userId}`)) : 0;
    // Strict "<": a token minted in the same second as the cutoff (the member
    // signing straight back in after a reset) is the new one and must work.
    if (cutoff && Number(decoded.iat) < cutoff) return true;
    if (decoded?.sid && await cacheGet(`sess_rev:${decoded.sid}`)) return true;
  } catch {
    /* fail open */
  }
  return false;
};

module.exports = { markSessionsRevoked, markUserRevoked, isAccessRevoked };
