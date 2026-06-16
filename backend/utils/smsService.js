/**
 * SMS OTP Service — Fast2SMS (primary) with MSG91 alternative.
 * Env vars: SMS_PROVIDER (fast2sms|msg91|dev), SMS_API_KEY, SMS_SENDER_ID
 * Falls back to dev mode (log-only) when unconfigured.
 */

const https = require('https');
const { get: cacheGet, set: cacheSet, del: cacheDel } = require('./cache');
const config = require('../config/env');
const { AppError } = require('../middlewares/errorHandler');
const log = require('../middlewares/logger');

const OTP_TTL_SECONDS = 600; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;

const otpKey = (phone) => `otp:${phone}`;
const rateKey = (phone) => `otp_rate:${phone}`;

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

// ─── Fast2SMS ─────────────────────────────────────────────────────────────────

const sendFast2SMS = (phone, code) => {
  return new Promise((resolve, reject) => {
    const apiKey = config.sms.apiKey;
    if (!apiKey) { reject(new Error('SMS_API_KEY not set')); return; }

    const message = `Your TricityShadi verification code is ${code}. Valid for 10 minutes. Do not share with anyone.`;
    const number = phone.replace(/^\+91/, '').replace(/\D/g, '');
    const body = JSON.stringify({
      route: 'q',
      sender_id: config.sms.senderId || 'TRCSDI',
      message,
      language: 'english',
      numbers: number,
    });

    const options = {
      hostname: 'www.fast2sms.com',
      path: '/dev/bulkV2',
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'cache-control': 'no-cache',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.return === true) resolve(parsed);
          else reject(new Error(parsed.message || 'Fast2SMS send failed'));
        } catch { reject(new Error('Fast2SMS invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// ─── MSG91 ────────────────────────────────────────────────────────────────────

const sendMSG91 = (phone, code) => {
  return new Promise((resolve, reject) => {
    const apiKey = config.sms.apiKey;
    const templateId = config.sms.msg91TemplateId;
    if (!apiKey) { reject(new Error('SMS_API_KEY not set')); return; }

    const mobile = phone.replace(/^\+/, '').replace(/\D/g, '');
    const body = JSON.stringify({
      template_id: templateId,
      mobile,
      authkey: apiKey,
      otp: code,
    });

    const options = {
      hostname: 'api.msg91.com',
      path: '/api/v5/otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'success') resolve(parsed);
          else reject(new Error(parsed.message || 'MSG91 send failed'));
        } catch { reject(new Error('MSG91 invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// ─── Rate limiting ────────────────────────────────────────────────────────────

const checkRateLimit = async (phone) => {
  const raw = await cacheGet(rateKey(phone));
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= 3) {
    throw new AppError('Too many OTP requests. Please wait before requesting again.', 429);
  }
  // Increment — set 3600s (1 hour) window if new, preserve TTL otherwise via re-set
  await cacheSet(rateKey(phone), String(count + 1), 3600);
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send OTP to phone. Enforces 3 sends/hour rate limit.
 * Returns { success, message, isDev }
 */
const sendOtp = async (phone) => {
  await checkRateLimit(phone);

  const code = generateCode();
  const payload = JSON.stringify({ code, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000, attempts: 0 });
  await cacheSet(otpKey(phone), payload, OTP_TTL_SECONDS);

  const provider = config.sms.provider;

  if (!provider || provider === 'dev' || !config.sms.isConfigured()) {
    // Production: warn about dev mode, don't log the OTP code (security)
    if (config.server.isProduction) {
      log.error(`[OTP PROD-DEV-MODE] SMS not configured in production. OTP for ${phone} generated but not sent.`);
    } else {
      log.info(`[OTP DEV] Code for ${phone}: ${code}`);
    }
    return { success: true, message: 'OTP sent (dev mode — check server logs)', isDev: true };
  }

  try {
    if (provider === 'msg91') await sendMSG91(phone, code);
    else await sendFast2SMS(phone, code);
    log.info(`[OTP] Sent via ${provider} to ${phone}`);
    return { success: true, message: 'OTP sent successfully', isDev: false };
  } catch (err) {
    await cacheDel(otpKey(phone));
    log.error(`[OTP] Send failed via ${provider}: ${err.message}`);
    throw new AppError('Failed to send OTP. Please try again.', 503);
  }
};

/**
 * Verify OTP. Throws AppError on invalid/expired/max-attempts.
 */
const verifyOtp = async (phone, code) => {
  // ⚠️ PRE-LAUNCH TESTING ONLY — master bypass codes (OTP_BYPASS_CODES) always
  // verify so login/signup work before SMS is wired. REMOVE before real users.
  const bypassCodes = config.sms.bypassCodes || [];
  if (bypassCodes.length > 0 && bypassCodes.includes(String(code))) {
    log.warn(`[OTP BYPASS] Master code used for ${phone} — disable OTP_BYPASS_CODES before launch.`);
    await cacheDel(otpKey(phone));
    return { success: true, message: 'OTP verified (bypass)' };
  }

  const raw = await cacheGet(otpKey(phone));
  if (!raw) throw new AppError('OTP expired or not sent. Please request a new one.', 400);

  let entry;
  try { entry = JSON.parse(raw); } catch { throw new AppError('OTP data corrupt. Please request a new one.', 400); }

  if (entry.expiresAt < Date.now()) {
    await cacheDel(otpKey(phone));
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    await cacheDel(otpKey(phone));
    throw new AppError('Too many incorrect attempts. Please request a new OTP.', 400);
  }

  if (entry.code !== code) {
    const updated = JSON.stringify({ ...entry, attempts: entry.attempts + 1 });
    const ttlSec = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    await cacheSet(otpKey(phone), updated, ttlSec);
    const remaining = MAX_VERIFY_ATTEMPTS - entry.attempts - 1;
    throw new AppError(`Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 400);
  }

  await cacheDel(otpKey(phone));
  return { success: true, message: 'OTP verified successfully' };
};

module.exports = { sendOtp, verifyOtp };
