/**
 * Funnel event tracking (Phase 0.5 — thin baseline).
 *
 * ONE util behind every emission point. Contract:
 *  - fire-and-forget: the returned promise is NEVER awaited on a response path.
 *    Callers do `trackEvent(userId, 'account_created');` and move on.
 *  - it never rejects and never throws: any failure (bad event name, DB down,
 *    FK race) is swallowed and `log.warn`ed. An analytics insert must never
 *    500 a signup.
 *  - `eventType` is validated here, in the app, against EVENT_TYPES — the column
 *    is a plain STRING(32), not a PG ENUM, so this is the only gate.
 *
 * Dedupe: the three account-bound events dedupe to once-per-user via the PARTIAL
 * unique index `(userId, eventType) WHERE userId IS NOT NULL` + ON CONFLICT DO
 * NOTHING, so callers can emit unconditionally on every repeated profile save /
 * match action. The two pre-account events fire before a User row exists, carry
 * userId NULL, and are therefore RAW COUNTERS — inflated by OTP resends, which
 * `scripts/funnel-report.sql` documents. Deduping them would mean storing the
 * contact (email/phone), which the privacy bound forbids.
 */

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { log } = require('../middlewares/logger');

// The funnel, in order. Extend here when a new stage ships (Phase S adds
// `invited_signup`) — no migration needed, by design.
const EVENT_TYPES = [
  'otp_send_attempted',    // pre-account counter (userId NULL)
  'otp_verify_succeeded',  // pre-account counter (userId NULL)
  'account_created',
  'profile_60pct',
  'first_interest_sent',
  'invited_signup',
];

/**
 * Record one funnel event.
 * @param {string|null} userId - account the event belongs to, or null pre-account.
 * @param {string} eventType - one of EVENT_TYPES.
 * @returns {Promise<void>} resolves always; do not await on a request path.
 */
const trackEvent = async (userId, eventType) => {
  try {
    if (!EVENT_TYPES.includes(eventType)) {
      log.warn('Analytics event rejected: unknown eventType', { eventType, userId: userId || null });
      return;
    }

    if (userId) {
      // Raw INSERT with ON CONFLICT rather than Model.create: a duplicate raises
      // a unique violation, and the point of the partial index is that repeats
      // are expected (every profile save, every like) — they must be a no-op,
      // not an error. Inference target names the partial predicate so Postgres
      // picks the right index. Mirrors profileController.unlockContact.
      await sequelize.query(
        `INSERT INTO "AnalyticsEvents" ("id", "eventType", "userId", "createdAt")
         VALUES (:id, :eventType, :userId, NOW())
         ON CONFLICT ("userId", "eventType") WHERE "userId" IS NOT NULL DO NOTHING`,
        {
          replacements: { id: randomUUID(), eventType, userId },
          type: QueryTypes.INSERT,
        }
      );
      return;
    }

    // Pre-account counter: nothing to conflict against (NULLs are distinct in
    // Postgres unique indexes), so a plain insert.
    await sequelize.query(
      `INSERT INTO "AnalyticsEvents" ("id", "eventType", "userId", "createdAt")
       VALUES (:id, :eventType, NULL, NOW())`,
      {
        replacements: { id: randomUUID(), eventType },
        type: QueryTypes.INSERT,
      }
    );
  } catch (err) {
    log.warn('Analytics event insert failed', {
      eventType,
      userId: userId || null,
      error: err.message,
    });
  }
};

// Single export by design: emission points only ever need trackEvent.
module.exports = { trackEvent };
