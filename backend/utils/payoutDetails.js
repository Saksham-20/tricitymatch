'use strict';

/**
 * A marketing rep's payout details: where the money goes, and the PAN that tax
 * deduction needs.
 *
 * These are bank-grade personal data, so:
 *  - stored encrypted (AES-256-GCM, key derived from JWT_SECRET with HKDF) in
 *    one blob; the table never holds a readable account number or PAN;
 *  - the rep sees them MASKED (last 4 only) and can overwrite but not read back
 *    the full value, so a hijacked rep session cannot exfiltrate them;
 *  - admins read them in full only through the audited payouts routes;
 *  - validated strictly, because a typo here sends real money to the wrong
 *    place and nothing downstream can catch it.
 *
 * Rotating JWT_SECRET makes stored details undecryptable (they would have to be
 * re-entered). That is the same trade the signed unsubscribe links make.
 */

const crypto = require('crypto');
const config = require('../config/env');
const { MarketingPayoutDetail } = require('../models');

class PayoutDetailsError extends Error {}

const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^[0-9]{9,18}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// A change this recent holds the rep out of automatic payout preparation: a
// hijacked account that swaps the destination right before a run is the classic
// way this kind of system is drained.
const RECENT_CHANGE_HOURS = 48;

const key = () => Buffer.from(
  crypto.hkdfSync('sha256', config.auth.jwtSecret, 'tricitymatch-payout-details', 'aes-256-gcm', 32)
);

const encrypt = (obj) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
};

const decrypt = (blob) => {
  const raw = Buffer.from(blob, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
};

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/** Validate and normalise what the rep typed. Throws PayoutDetailsError. */
const validate = (input = {}) => {
  const method = clean(input.method).toLowerCase();
  if (!['upi', 'bank'].includes(method)) throw new PayoutDetailsError('Choose UPI or bank transfer');

  const pan = clean(input.pan).toUpperCase();
  if (!PAN_RE.test(pan)) throw new PayoutDetailsError('Enter a valid PAN (for example ABCDE1234F)');

  const out = { method, pan };
  if (method === 'upi') {
    const upiId = clean(input.upiId).toLowerCase();
    if (!UPI_RE.test(upiId)) throw new PayoutDetailsError('Enter a valid UPI ID (for example name@bank)');
    out.upiId = upiId;
    // The name on the UPI account helps the admin spot a wrong handle.
    const holder = clean(input.accountHolder);
    if (holder) out.accountHolder = holder.slice(0, 80);
  } else {
    const holder = clean(input.accountHolder);
    if (holder.length < 2 || holder.length > 80) throw new PayoutDetailsError('Enter the account holder name as it appears at the bank');
    const accountNumber = clean(input.accountNumber).replace(/\s+/g, '');
    if (!ACCOUNT_RE.test(accountNumber)) throw new PayoutDetailsError('Account number must be 9 to 18 digits');
    const ifsc = clean(input.ifsc).toUpperCase();
    if (!IFSC_RE.test(ifsc)) throw new PayoutDetailsError('Enter a valid IFSC code (for example HDFC0001234)');
    out.accountHolder = holder;
    out.accountNumber = accountNumber;
    out.ifsc = ifsc;
  }
  return out;
};

const mask = (v) => (v ? `${'•'.repeat(Math.max(0, String(v).length - 4))}${String(v).slice(-4)}` : null);

/** What the REP may see: shape of their details with everything sensitive masked. */
const maskedView = (d) => ({
  method: d.method,
  accountHolder: d.accountHolder || null,
  upiId: d.upiId ? `${d.upiId.split('@')[0].slice(0, 2)}${'•'.repeat(3)}@${d.upiId.split('@')[1]}` : null,
  accountNumber: mask(d.accountNumber),
  ifsc: d.ifsc || null,
  pan: d.pan ? `${d.pan.slice(0, 2)}${'•'.repeat(6)}${d.pan.slice(-2)}` : null,
});

/** Save (create or replace) a rep's details. Returns the masked view. */
const saveDetails = async (marketingUserId, input) => {
  const clean_ = validate(input);
  await MarketingPayoutDetail.upsert({
    marketingUserId,
    method: clean_.method,
    payload: encrypt(clean_),
  });
  return maskedView(clean_);
};

/** Masked view for the rep, or null when nothing is saved. */
const getMaskedDetails = async (marketingUserId) => {
  const row = await MarketingPayoutDetail.findByPk(marketingUserId);
  if (!row) return null;
  try {
    return { ...maskedView(decrypt(row.payload)), updatedAt: row.updatedAt };
  } catch (_) {
    return { method: row.method, unreadable: true, updatedAt: row.updatedAt };
  }
};

/** Full details. Admin payout routes ONLY, and the caller audits the read. */
const getFullDetails = async (marketingUserId) => {
  const row = await MarketingPayoutDetail.findByPk(marketingUserId);
  if (!row) return null;
  try {
    return { ...decrypt(row.payload), updatedAt: row.updatedAt };
  } catch (_) {
    return { method: row.method, unreadable: true, updatedAt: row.updatedAt };
  }
};

const changedRecently = (updatedAt, now = Date.now()) =>
  Boolean(updatedAt) && now - new Date(updatedAt).getTime() < RECENT_CHANGE_HOURS * 3600 * 1000;

module.exports = {
  PayoutDetailsError,
  RECENT_CHANGE_HOURS,
  validate,
  maskedView,
  saveDetails,
  getMaskedDetails,
  getFullDetails,
  changedRecently,
  __encrypt: encrypt,
  __decrypt: decrypt,
};
