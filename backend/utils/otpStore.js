'use strict';

/**
 * One-time codes for verifying a contact (phone, email) or an email change.
 *
 * What this fixes over the per-caller copies it replaces:
 *  - codes come from crypto.randomInt, not Math.random
 *  - only an HMAC of the code is stored, so a cache read does not reveal a
 *    usable code
 *  - wrong-guess counting is an atomic INCR taken BEFORE the comparison, so
 *    parallel guesses cannot exceed the budget (the old read-then-write let a
 *    burst of N parallel requests make N guesses against a 5-attempt code)
 *  - a correct code is consumed with an atomic take, so two parallel correct
 *    submissions cannot both succeed
 *  - one send budget applies to phone AND email targets
 */

const crypto = require('crypto');
const config = require('../config/env');
const { AppError } = require('../middlewares/errorHandler');
const { get: cacheGet, set: cacheSet, del: cacheDel, incr: cacheIncr, take: cacheTake } = require('./cache');

const CODE_TTL_SECONDS = 600;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 3;
const SEND_WINDOW_SECONDS = 3600;

const codeKey = (ns, target) => `otp:${ns}:${target}`;
const triesKey = (ns, target) => `otp_tries:${ns}:${target}`;
const sendsKey = (ns, target) => `otp_sends:${ns}:${target}`;

const hmacKey = () =>
  crypto.hkdfSync('sha256', String(config.auth.jwtSecret), 'tricitymatch', 'otp-code-v1', 32);

const hashCode = (ns, target, code) =>
  crypto.createHmac('sha256', Buffer.from(hmacKey())).update(`${ns}:${target}:${code}`).digest('hex');

const randomCode = (digits) =>
  String(crypto.randomInt(10 ** (digits - 1), 10 ** digits));

/** Counts a send against the per-target hourly budget. Throws 429 when spent. */
const spendSend = async (ns, target) => {
  const used = await cacheIncr(sendsKey(ns, target), SEND_WINDOW_SECONDS);
  if (used > MAX_SENDS_PER_HOUR) {
    throw new AppError('Too many OTP requests. Please wait before requesting again.', 429);
  }
};

/**
 * Create a code for `target`, store its hash, and return the plain code for the
 * caller to deliver. Starts a fresh attempt counter. `extra` is stored beside
 * the hash (for example the member an email change was issued to).
 */
const issue = async (ns, target, { digits = 6, extra = {} } = {}) => {
  const code = randomCode(digits);
  await cacheSet(
    codeKey(ns, target),
    { hash: hashCode(ns, target, code), expiresAt: Date.now() + CODE_TTL_SECONDS * 1000, ...extra },
    CODE_TTL_SECONDS
  );
  await cacheDel(triesKey(ns, target));
  return code;
};

/** Drop a code that could not be delivered so it cannot be guessed blind. */
const discard = async (ns, target) => {
  await cacheDel(codeKey(ns, target));
  await cacheDel(triesKey(ns, target));
};

const safeEqualHex = (a, b) => {
  const x = Buffer.from(String(a), 'hex');
  const y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

/**
 * Check `code` for `target`. Resolves with the stored `extra` fields on
 * success. Throws AppError(400) otherwise. Single use.
 */
const verify = async (ns, target, code) => {
  const entry = await cacheGet(codeKey(ns, target));
  if (!entry || typeof entry !== 'object') {
    throw new AppError('OTP expired or not sent. Please request a new one.', 400);
  }
  if (entry.expiresAt < Date.now()) {
    await discard(ns, target);
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  const tries = await cacheIncr(triesKey(ns, target), CODE_TTL_SECONDS);
  if (tries > MAX_VERIFY_ATTEMPTS) {
    await discard(ns, target);
    throw new AppError('Too many incorrect attempts. Please request a new OTP.', 400);
  }

  const supplied = hashCode(ns, target, String(code || '').trim());
  if (!safeEqualHex(supplied, entry.hash)) {
    const remaining = MAX_VERIFY_ATTEMPTS - tries;
    if (remaining <= 0) await discard(ns, target);
    throw new AppError(`Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 400);
  }

  // Correct. Whoever removes the entry first owns the success.
  const taken = await cacheTake(codeKey(ns, target));
  if (!taken) throw new AppError('OTP expired or not sent. Please request a new one.', 400);
  await cacheDel(triesKey(ns, target));
  return taken;
};

module.exports = {
  issue, verify, discard, spendSend, randomCode, hashCode,
  CODE_TTL_SECONDS, MAX_VERIFY_ATTEMPTS, MAX_SENDS_PER_HOUR,
};
