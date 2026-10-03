'use strict';

/**
 * Hand-over of a profile someone else set up (audit P1-14).
 *
 * A parent or sibling can create a profile for a relative, which means the
 * account starts life under THEIR email/phone and password. Nothing let the
 * subject ever take it over: the person the profile is about could not become
 * its owner. This is that flow.
 *
 *   manager (signed in, re-enters their password) names the owner's email
 *     -> a one-time link goes to that address (7 days)
 *     -> owner opens it, chooses a password
 *     -> the account is theirs: their email is the sign-in, their password is
 *        the only credential, every session the manager held is revoked, the
 *        manager's phone is detached (the owner adds their own), and any
 *        two-step secret the manager enrolled is wiped.
 *
 * The token is a 32-byte secret stored only as a hash and consumed atomically
 * (`take`), so a link cannot be used twice even by two simultaneous requests.
 * Possession of the link is the proof of control over the mailbox.
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, RefreshToken } = require('../models');
const sequelize = require('../config/database');
const cache = require('./cache');
const { emailLookupCandidates, canonicalEmail } = require('./emailAddress');
const { createError } = require('../middlewares/errorHandler');
const config = require('../config/env');

const TTL_SECONDS = 7 * 24 * 3600;
const keyFor = (token) => `handover:${crypto.createHash('sha256').update(String(token)).digest('hex')}`;
const handoverLink = (token) => `${config.server.frontendUrl}/handover?token=${token}`;

const emailInUse = async (email, exceptUserId) => {
  const candidates = emailLookupCandidates(email);
  if (!candidates.length) return false;
  const where = { email: { [Op.in]: candidates } };
  if (exceptUserId) where.id = { [Op.ne]: exceptUserId };
  return Boolean(await User.count({ where }));
};

/** Issue a hand-over token for `managerUser`'s account to `ownerEmail`. */
const issueHandover = async ({ managerUser, ownerEmail, managerName }) => {
  const email = canonicalEmail(ownerEmail);
  if (!email) throw createError.badRequest('A valid email is required');
  if (email === canonicalEmail(managerUser.email)) {
    throw createError.badRequest('That is already this account\'s email. Use a different address.');
  }
  if (await emailInUse(email, managerUser.id)) {
    // Not distinguishable from success to a caller who is not the account's
    // manager, but the manager is authenticated and re-proved their password,
    // and needs to know why nothing was sent.
    throw createError.conflict('That email already has a TricityMatch account. The owner should sign in with it and invite you as a guardian instead.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  const stored = await cache.set(keyFor(token), { userId: managerUser.id, email, managerName: managerName || null }, TTL_SECONDS);
  if (!stored) throw createError.internal('Could not create the hand-over link. Try again in a moment.');
  return { token, link: handoverLink(token), email };
};

/** Complete a hand-over. Returns the new owner's user id. */
const completeHandover = async ({ token, password }) => {
  const data = await cache.take(keyFor(token));
  if (!data) throw createError.badRequest('This hand-over link is invalid or has already been used.');

  const user = await User.findByPk(data.userId);
  if (!user || user.status !== 'active') {
    throw createError.badRequest('This hand-over link is no longer valid.');
  }
  if (await emailInUse(data.email, user.id)) {
    throw createError.conflict('That email now belongs to another account.');
  }

  const previousEmail = user.email;
  await sequelize.transaction(async (t) => {
    const consent = { ...(user.consent || {}), handedOver: { at: new Date().toISOString(), from: previousEmail ? 'manager' : 'unknown' } };
    await user.update({
      email: data.email,
      emailVerified: true,
      password,
      // The manager's number must not stay on the owner's account.
      phone: null,
      phoneVerified: false,
      // ...and neither may a separately verified contact number: it is what
      // unlockers are handed in preference to the login number.
      contactPhone: null,
      // Two-step secrets are personal; the owner enrols their own.
      mfaSecret: null,
      mfaEnabledAt: null,
      mfaRecoveryHashes: null,
      consent,
    }, { transaction: t });
    await RefreshToken.revokeAllUserTokens(user.id, 'account_handover');
  });

  return { userId: user.id, previousEmail, email: data.email };
};

module.exports = { issueHandover, completeHandover, TTL_SECONDS };
