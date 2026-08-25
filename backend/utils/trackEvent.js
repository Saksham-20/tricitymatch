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
  // Traffic stages — RAW COUNTERS, always emitted with userId NULL even for a
  // signed-in visitor. They answer "how many people got this far this week",
  // which is a volume question; deduping them per account would turn them into
  // something else. Reported by the client beacon (POST /api/v1/events), the
  // only place the funnel could not be measured server-side.
  'landing_view',
  'signup_started',
  'plans_viewed',
  'checkout_started',
  // Account funnel — emitted server-side from the controllers.
  'otp_send_attempted',    // pre-account counter (userId NULL)
  'otp_verify_succeeded',  // pre-account counter (userId NULL)
  'account_created',
  'profile_60pct',
  'first_interest_sent',
  'invited_signup',
];

// Stages the browser reports. Kept as its own list so the public endpoint can
// never be used to forge an account-funnel stage (`account_created` from a
// curl loop would corrupt the only conversion numbers we have).
const CLIENT_EVENT_TYPES = ['landing_view', 'signup_started', 'plans_viewed', 'checkout_started'];

// Traffic stages are volume counters: force userId NULL so the partial unique
// index never dedupes them down to one per member.
const RAW_COUNTER_TYPES = new Set([
  ...CLIENT_EVENT_TYPES,
  'otp_send_attempted',
  'otp_verify_succeeded',
]);

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

    if (userId && !RAW_COUNTER_TYPES.has(eventType)) {
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

module.exports = { trackEvent, EVENT_TYPES, CLIENT_EVENT_TYPES };
