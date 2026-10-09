'use strict';

/**
 * Two-step verification (TOTP) enrolment for the signed-in account.
 *
 *   GET  /auth/mfa/status
 *   POST /auth/mfa/setup     { password }   -> secret + otpauth URI (not yet active)
 *   POST /auth/mfa/enable    { code }       -> activates, returns recovery codes ONCE
 *   POST /auth/mfa/disable   { password, code }
 *
 * Login itself lives in authController (it must run before a session exists).
 */

const { User } = require('../models');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { logAudit } = require('../middlewares/logger');
const { STAFF_ROLES } = require('../constants/adminScopes');
const { checkSecondFactor } = require('../utils/mfa');
const {
  generateSecret, otpauthUri, encryptSecret, decryptSecret, verifyTotp, generateRecoveryCodes,
} = require('../utils/totp');

const isStaff = (role) => STAFF_ROLES.includes(role);
const mfaRequiredFor = (user) => config.features.staffMfaRequired && isStaff(user.role);

const loadUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw createError.unauthorized('Not authenticated');
  return user;
};

const reauthenticate = async (user, password) => {
  if (!user.password) {
    throw createError.badRequest('Set a password on this account before enabling two-step verification');
  }
  if (!password) throw createError.badRequest('Your password is required');
  if (!(await user.comparePassword(password))) throw createError.unauthorized('Incorrect password', 'INVALID_PASSWORD');
};

exports.getMfaStatus = asyncHandler(async (req, res) => {
  const user = await loadUser(req.user.id);
  res.json({
    success: true,
    enabled: Boolean(user.mfaEnabledAt),
    required: mfaRequiredFor(user),
    recoveryCodesRemaining: Array.isArray(user.mfaRecoveryHashes) ? user.mfaRecoveryHashes.length : 0,
  });
});

exports.setupMfa = asyncHandler(async (req, res) => {
  const user = await loadUser(req.user.id);
  if (user.mfaEnabledAt) throw createError.conflict('Two-step verification is already on');
  await reauthenticate(user, req.body.password);

  const secret = generateSecret();
  user.mfaSecret = encryptSecret(secret);
  user.mfaEnabledAt = null;
  await user.save();

  res.json({
    success: true,
    secret,
    otpauthUri: otpauthUri(secret, user.email || user.phone || user.id),
  });
});

exports.enableMfa = asyncHandler(async (req, res) => {
  const user = await loadUser(req.user.id);
  if (user.mfaEnabledAt) throw createError.conflict('Two-step verification is already on');
  if (!user.mfaSecret) throw createError.badRequest('Start setup first');

  let secret;
  try { secret = decryptSecret(user.mfaSecret); } catch { throw createError.badRequest('Start setup again'); }
  if (verifyTotp(secret, req.body.code) === null) throw createError.badRequest('That code is not right. Check the time on your device and try again.');

  const { codes, hashes } = generateRecoveryCodes();
  user.mfaEnabledAt = new Date();
  user.mfaRecoveryHashes = hashes;
  await user.save();

  logAudit('mfa_enabled', user.id, { role: user.role });
  res.json({ success: true, recoveryCodes: codes });
});

exports.disableMfa = asyncHandler(async (req, res) => {
  const user = await loadUser(req.user.id);
  if (!user.mfaEnabledAt) throw createError.badRequest('Two-step verification is not on');
  if (mfaRequiredFor(user)) {
    throw createError.forbidden('Two-step verification is required for your role and cannot be turned off', 'MFA_REQUIRED_FOR_ROLE');
  }
  await reauthenticate(user, req.body.password);
  const factor = await checkSecondFactor(user, req.body.code);
  if (!factor.ok) throw createError.unauthorized('That code is not right', 'INVALID_MFA_CODE');

  user.mfaSecret = null;
  user.mfaEnabledAt = null;
  user.mfaRecoveryHashes = null;
  await user.save();

  logAudit('mfa_disabled', user.id, { role: user.role });
  res.json({ success: true });
});
