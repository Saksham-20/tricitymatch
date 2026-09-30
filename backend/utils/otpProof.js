'use strict';

/**
 * Proof that a contact (email / phone) was just verified by OTP, for signup.
 *
 * verify-otp used to leave a marker keyed only on the contact, so ANYONE who
 * knew a contact had just been verified could finish a signup with it inside
 * the 30-minute window. The marker now stores a random proof that verify-otp
 * returns only to the caller who entered the correct code; signup must present
 * it, and it is single-use.
 */

const crypto = require('crypto');
const { get: cacheGet, set: cacheSet, del: cacheDel } = require('./cache');

const PROOF_TTL_SECONDS = 1800;
const markerKey = (kind, contact) => `otp-verified:${kind}:${contact}`;

const issueProof = async (kind, contact) => {
  const proof = crypto.randomBytes(24).toString('hex');
  await cacheSet(markerKey(kind, contact), proof, PROOF_TTL_SECONDS);
  return proof;
};

/** True (and consumed) only when `proof` matches the stored one for this contact. */
const consumeProof = async (kind, contact, proof) => {
  if (!contact || typeof proof !== 'string' || !proof) return false;
  const key = markerKey(kind, contact);
  const stored = await cacheGet(key);
  if (typeof stored !== 'string' || stored.length !== proof.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(proof))) return false;
  await cacheDel(key);
  return true;
};

module.exports = { issueProof, consumeProof, markerKey, PROOF_TTL_SECONDS };
