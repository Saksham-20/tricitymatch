/**
 * SMS OTP Service — Fast2SMS (primary) with MSG91 alternative.
 * Env vars: SMS_PROVIDER (fast2sms|msg91|dev), SMS_API_KEY, SMS_SENDER_ID
 * Falls back to dev mode (log-only) when unconfigured.
 */

const https = require('https');
const { incr: cacheIncr } = require('./cache');
const otpStore = require('./otpStore');
const config = require('../config/env');
const { AppError } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');

const NS = 'phone';
// Only Indian mobile numbers can receive our DLT-registered template; a foreign
// number would still be billed and never delivered.
const INDIAN_MOBILE = /^91[6-9]\d{9}$/;
// 4-digit OTP to match the registered DLT/MSG91 template (##OTP## = 4 digits)
const OTP_DIGITS = 4;

/**
 * Canonicalize a phone number to digits-with-country-code (default India: 91XXXXXXXXXX).
 * Clients are inconsistent — web posts a bare 10-digit number, mobile prepends +91.
 * MSG91 v5 requires `mobile=91XXXXXXXXXX`; a bare 10-digit number returns type:success but
 * never delivers. We normalize ONCE here so (a) the provider always gets a routable number
 * and (b) send/verify always hit the same Redis key regardless of the string the client sent.
 * Returns canonical digits, or null if the input can't be a valid number (caller must reject).
 */
const normalizePhone = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  // Strip a single leading 0 (national trunk prefix, e.g. 07973… → 7973…)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  // Bare 10-digit Indian mobile → prepend country code
  if (digits.length === 10) return `91${digits}`;
  // Already India E.164 (91 + 10 digits)
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  // Some other country code already present (11–15 digits) → keep as-is
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
};

// ─── Fast2SMS ─────────────────────────────────────────────────────────────────

const sendFast2SMS = (phone, code) => {
  return new Promise((resolve, reject) => {
    const apiKey = config.sms.apiKey;
    if (!apiKey) { reject(new Error('SMS_API_KEY not set')); return; }

    const message = `Your TricityMatch verification code is ${code}. Valid for 10 minutes. Do not share with anyone.`;
    // `phone` is canonical (91XXXXXXXXXX); Fast2SMS wants the 10-digit national form.
    const number = phone.replace(/^91/, '');
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
    const apiKey = config.sms.apiKey;          // MSG91 authkey
    const templateId = config.sms.msg91TemplateId;
    if (!apiKey) { reject(new Error('SMS_API_KEY (MSG91 authkey) not set')); return; }
    if (!templateId) { reject(new Error('MSG91_TEMPLATE_ID not set')); return; }

    // MSG91 v5 OTP API. We pass our own `otp` so MSG91 injects it into ##OTP##
    // (we still verify locally against Redis). otp_length must match the template.
    // `phone` is already canonical (91XXXXXXXXXX) from normalizePhone().
    const mobile = String(phone).replace(/\D/g, '');
    // Don't trust MSG91's lying type:success — refuse to send a number that isn't
    // a routable India MSI (91 + 10 digits) or a plausible international length.
    if (!(mobile.length === 12 && mobile.startsWith('91')) && (mobile.length < 11 || mobile.length > 15)) {
      reject(new Error(`MSG91 unroutable mobile: ${mobile}`));
      return;
    }
    const query = new URLSearchParams({
      template_id: templateId,
      mobile,
      otp: code,
      otp_length: '4',
      otp_expiry: '10',
    }).toString();

    // Empty template-vars body (OTP injected via ##OTP##). authkey goes in header.
    const body = JSON.stringify({});

    const options = {
      hostname: 'control.msg91.com',
      path: `/api/v5/otp?${query}`,
      method: 'POST',
      family: 4, // force IPv4 — MSG91 authkey IP-whitelist is IPv4-only
      headers: {
        authkey: apiKey,
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

// ─── Global send budget ───────────────────────────────────────────────────────

const budgetDayKey = () => `otp_sms_day:${new Date().toISOString().slice(0, 10)}`;

/**
 * Count one billed text against the daily ceiling across every number. Alerts at
 * 80% and refuses past 100%. Fails closed on the ceiling only; a cache error
 * here must not turn into an unlimited spend, so it propagates.
 */
const spendGlobalBudget = async () => {
  const budget = config.sms.dailyBudget;
  if (!budget || budget <= 0) return;
  const used = await cacheIncr(budgetDayKey(), 90000);
  if (used >= Math.ceil(budget * 0.8)) {
    log.error(`[OTP] SMS daily budget at ${used}/${budget}`);
    try {
      const { triggerAlert, ALERT_TYPES, SEVERITY } = require('./alerts');
      await triggerAlert(
        ALERT_TYPES.RATE_LIMIT_EXCEEDED,
        used > budget ? SEVERITY.CRITICAL : SEVERITY.WARNING,
        `SMS OTP daily budget ${used}/${budget}`,
        { used, budget }
      );
    } catch { /* alerting must never block a member */ }
  }
  if (used > budget) {
    throw new AppError('We cannot send verification codes right now. Please try again later.', 503);
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send OTP to phone. Enforces 3 sends/hour rate limit.
 * Returns { success, message, isDev }
 */
const sendOtp = async (rawPhone) => {
  // Canonicalize FIRST — never store/send an unroutable number (no fake success).
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new AppError('A valid phone number is required.', 400);
  if (!INDIAN_MOBILE.test(phone)) {
    throw new AppError('Enter a valid 10-digit Indian mobile number, or sign up with your email.', 400);
  }

  await otpStore.spendSend(NS, phone);

  const provider = config.sms.provider;
  const live = provider && provider !== 'dev' && config.sms.isConfigured();
  if (live) await spendGlobalBudget();

  const code = await otpStore.issue(NS, phone, { digits: OTP_DIGITS });

  if (!live) {
    // Never log the code in production. Only genuine development prints it; the
    // previous `else` also covered 'staging', 'qa' and any unrecognised NODE_ENV.
    if (config.server.isProduction) {
      log.error('[OTP PROD-DEV-MODE] SMS not configured in production. OTP generated but not sent.');
    } else if (config.isDevelopment) {
      // The code is in the message string, where the log redactor cannot mask it.
      log.info(`[OTP DEV] Code for ***${phone.slice(-4)}: ${code}`);
    } else {
      log.warn(`[OTP] SMS not configured for NODE_ENV=${config.env}; code generated but not logged.`);
    }
    return { success: true, message: 'OTP sent (dev mode — check server logs)', isDev: true };
  }

  try {
    if (provider === 'msg91') await sendMSG91(phone, code);
    else await sendFast2SMS(phone, code);
    log.info(`[OTP] Sent via ${provider}`);
    return { success: true, message: 'OTP sent successfully', isDev: false };
  } catch (err) {
    await otpStore.discard(NS, phone);
    log.error(`[OTP] Send failed via ${provider}: ${err.message}`);
    throw new AppError('Failed to send OTP. Please try again.', 503);
  }
};

/**
 * Verify OTP. Throws AppError on invalid/expired/max-attempts.
 */
const verifyOtp = async (rawPhone, code) => {
  // Same canonicalization as sendOtp so the key matches regardless of the
  // string form the client sent on verify (e.g. bare 7973… vs +91 79734…).
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new AppError('A valid phone number is required.', 400);

  // ⚠️ PRE-LAUNCH TESTING ONLY — master bypass codes (OTP_BYPASS_CODES) always
  // verify so login/signup work before SMS is wired. Fatal at boot in production.
  const bypassCodes = config.sms.bypassCodes || [];
  if (bypassCodes.length > 0 && bypassCodes.includes(String(code))) {
    log.warn('[OTP BYPASS] Master code used — disable OTP_BYPASS_CODES before launch.');
    await otpStore.discard(NS, phone);
    return { success: true, message: 'OTP verified (bypass)' };
  }

  await otpStore.verify(NS, phone, code);
  return { success: true, message: 'OTP verified successfully' };
};

module.exports = { sendOtp, verifyOtp, normalizePhone };
