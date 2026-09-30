'use strict';

/**
 * One canonical form for an email address, used at signup, login, password
 * reset, OTP send/verify, and every uniqueness or lookup check.
 *
 * Signup used express-validator's normalizeEmail(), which for Gmail also strips
 * dots and "+tags" — so `first.last@gmail.com` was STORED as `firstlast@gmail.com`.
 * Login did not run the same normaliser, so typing the address the member had
 * registered with answered "Invalid credentials" (and counted toward lockout).
 * OTP send and verify keyed the code on differently-cased strings, and the
 * "email verified" marker signup consumed was keyed on the rewritten address, so
 * `emailVerified` never became true for those members.
 *
 * Rule now: STORE and COMPARE the address the member typed, lower-cased and
 * trimmed, and nothing cleverer. LOOK UP with candidates so accounts created
 * before this change (stored in the rewritten form) still work.
 */

const validator = require('validator');

const canonicalEmail = (input) => {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  return value || null;
};

/**
 * The form the OLD signup stored (Gmail dots/tags stripped, googlemail folded).
 * Only ever used to find pre-existing accounts, never to write.
 */
const legacyNormalizedEmail = (input) => {
  const canonical = canonicalEmail(input);
  if (!canonical) return null;
  return validator.normalizeEmail(canonical) || canonical;
};

/** Every stored form this address could be under, canonical first. */
const emailLookupCandidates = (input) => {
  const canonical = canonicalEmail(input);
  if (!canonical) return [];
  const legacy = legacyNormalizedEmail(canonical);
  return legacy && legacy !== canonical ? [canonical, legacy] : [canonical];
};

/**
 * Key for per-identifier brute-force lockout. Collapses the spelling variants of
 * one mailbox (dots, +tags) so an attacker cannot multiply the attempt budget by
 * retrying `a.b@gmail.com`, `ab@gmail.com`, `ab+1@gmail.com`...
 */
const emailIdentityKey = (input) => legacyNormalizedEmail(input);

module.exports = { canonicalEmail, legacyNormalizedEmail, emailLookupCandidates, emailIdentityKey };
