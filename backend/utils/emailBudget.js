'use strict';

/**
 * Global daily ceiling on mail an anonymous caller can trigger (email OTP,
 * password reset, email change). Mirrors the SMS budget in smsService: counts
 * one send, alerts at 80%, and refuses past 100%. The shared Resend quota was
 * exhausted once; per-IP limits alone do not stop a distributed caller.
 *
 * Callers choose how to react to a refusal. An enumeration-sensitive endpoint
 * (forgot-password) must NOT surface it, so `spendEmailBudget` returns false
 * rather than throwing.
 */

const config = require('../config/env');
const { incr: cacheIncr } = require('./cache');
const { log } = require('../middlewares/logger');

const dayKey = () => `email_acct_day:${new Date().toISOString().slice(0, 10)}`;

/** true = send allowed; false = today's ceiling is spent. */
const spendEmailBudget = async () => {
  const budget = config.email.dailyBudget;
  if (!budget || budget <= 0) return true;
  const used = await cacheIncr(dayKey(), 90000);
  if (used >= Math.ceil(budget * 0.8)) {
    log.error(`[EMAIL] account-mail daily budget at ${used}/${budget}`);
    try {
      const { triggerAlert, ALERT_TYPES, SEVERITY } = require('./alerts');
      await triggerAlert(
        ALERT_TYPES.RATE_LIMIT_EXCEEDED,
        used > budget ? SEVERITY.CRITICAL : SEVERITY.WARNING,
        `Account email daily budget ${used}/${budget}`,
        { used, budget }
      );
    } catch { /* alerting must never block a member */ }
  }
  return used <= budget;
};

module.exports = { spendEmailBudget };
