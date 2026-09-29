'use strict';

/**
 * Second-factor checks shared by login and the MFA endpoints.
 */

const { get: cacheGet, set: cacheSet } = require('./cache');
const { verifyTotp, decryptSecret, hashRecovery, STEP_SECONDS } = require('./totp');

/**
 * Check a code against the member's enabled second factor. Accepts a current
 * TOTP code (each time step usable ONCE, so a code shoulder-surfed or captured
 * in transit cannot be replayed) or an unused recovery code.
 *
 * @returns {Promise<{ ok: boolean, recoveryUsed?: string }>}
 */
const checkSecondFactor = async (user, code) => {
  const raw = String(code || '').trim();
  if (!raw || !user.mfaSecret) return { ok: false };

  if (/^[\d\s]{6,7}$/.test(raw)) {
    let secret;
    try { secret = decryptSecret(user.mfaSecret); } catch { return { ok: false }; }
    const step = verifyTotp(secret, raw);
    if (step === null) return { ok: false };
    const usedKey = `mfa-used:${user.id}:${step}`;
    if (await cacheGet(usedKey)) return { ok: false };
    await cacheSet(usedKey, '1', STEP_SECONDS * 4);
    return { ok: true };
  }

  const hash = hashRecovery(raw);
  const hashes = Array.isArray(user.mfaRecoveryHashes) ? user.mfaRecoveryHashes : [];
  if (hashes.includes(hash)) return { ok: true, recoveryUsed: hash };
  return { ok: false };
};

module.exports = { checkSecondFactor };
