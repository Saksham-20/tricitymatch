'use strict';

/**
 * Server-side provenance for the verification selfie.
 *
 * "Live camera only" is a client behaviour (getUserMedia on web, the camera
 * intent on mobile); the server cannot see how a JPEG was made. What it CAN do
 * is refuse a submission that did not come out of a capture session it started:
 * the client asks for a session when the camera opens, and the submission must
 * present that single-use token, no sooner than a person could plausibly have
 * taken a photo and no later than the session lives. That stops scripted
 * submissions and replay of an old token; it does not stop a determined member
 * pointing a camera at a screen, which is why a human still compares the selfie
 * to the profile photos before any badge is given.
 */

const crypto = require('crypto');
const { set: cacheSet, take: cacheTake } = require('./cache');

const SESSION_TTL_SECONDS = 15 * 60;
const MIN_CAPTURE_MS = 2000;

const keyFor = (userId, token) =>
  `capture:${userId}:${crypto.createHash('sha256').update(token).digest('hex')}`;

const startSession = async (userId) => {
  const token = crypto.randomBytes(24).toString('hex');
  await cacheSet(keyFor(userId, token), { issuedAt: Date.now() }, SESSION_TTL_SECONDS);
  return { token, expiresInSeconds: SESSION_TTL_SECONDS };
};

/** Consume a token. Returns { ok:true } or { ok:false, reason }. */
const consumeSession = async (userId, token, now = Date.now()) => {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return { ok: false, reason: 'missing' };
  const entry = await cacheTake(keyFor(userId, token));
  if (!entry || typeof entry.issuedAt !== 'number') return { ok: false, reason: 'invalid' };
  if (now - entry.issuedAt < MIN_CAPTURE_MS) return { ok: false, reason: 'too_fast' };
  return { ok: true };
};

module.exports = { startSession, consumeSession, SESSION_TTL_SECONDS, MIN_CAPTURE_MS };
