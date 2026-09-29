'use strict';

/**
 * TOTP (RFC 6238) second factor — dependency-free (HMAC-SHA1, 6 digits, 30 s).
 *
 * The secret is encrypted at rest with AES-256-GCM under a key derived (HKDF)
 * from JWT_SECRET, so a database dump alone does not yield working second
 * factors. Rotating JWT_SECRET therefore invalidates enrolments (as it already
 * does unsubscribe links); recovery codes remain valid because they are hashed,
 * not encrypted.
 */

const crypto = require('crypto');
const config = require('../config/env');

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // accept the previous and next step: clock drift

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (buf) => {
  let bits = 0; let value = 0; let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
};

const base32Decode = (str) => {
  let bits = 0; let value = 0; const out = [];
  for (const ch of String(str).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32');
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
};

const generateSecret = () => base32Encode(crypto.randomBytes(20));

const hotp = (secretBuf, counter) => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuf).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % (10 ** DIGITS)).padStart(DIGITS, '0');
};

const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

const totpAt = (secret, now = Date.now()) => hotp(base32Decode(secret), currentStep(now));

/**
 * @returns {number|null} the matching time step (for replay protection), or null.
 */
const verifyTotp = (secret, code, now = Date.now()) => {
  const candidate = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(candidate)) return null;
  const key = base32Decode(secret);
  const step = currentStep(now);
  for (let w = -WINDOW; w <= WINDOW; w += 1) {
    const expected = hotp(key, step + w);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) return step + w;
  }
  return null;
};

const otpauthUri = (secret, account, issuer = 'TricityMatch') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

// ---- encryption at rest ----
const encryptionKey = () => Buffer.from(
  crypto.hkdfSync('sha256', String(config.auth.jwtSecret), 'tricitymatch', 'mfa-secret-v1', 32)
);

const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
};

const decryptSecret = (stored) => {
  const [version, iv, tag, enc] = String(stored || '').split('.');
  if (version !== 'v1' || !iv || !tag || !enc) throw new Error('Unreadable MFA secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString('utf8');
};

// ---- recovery codes ----
const RECOVERY_COUNT = 10;
const hashRecovery = (code) => crypto.createHash('sha256').update(String(code).trim().toLowerCase()).digest('hex');

/** @returns {{ codes: string[], hashes: string[] }} plaintext shown once, hashes stored */
const generateRecoveryCodes = () => {
  const codes = Array.from({ length: RECOVERY_COUNT }, () => {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashRecovery) };
};

module.exports = {
  generateSecret, totpAt, verifyTotp, otpauthUri,
  encryptSecret, decryptSecret,
  generateRecoveryCodes, hashRecovery,
  base32Encode, base32Decode, STEP_SECONDS,
};
