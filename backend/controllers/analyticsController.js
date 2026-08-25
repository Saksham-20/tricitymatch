'use strict';

/**
 * Funnel reads + the client beacon.
 *
 * The account half of the funnel is emitted server-side (utils/trackEvent.js,
 * called from the auth/profile/match controllers). The half that cannot be —
 * how many people reached the site at all, and how far they got before an
 * account existed — is reported by the browser through `recordClientEvent`.
 *
 * Everything here treats analytics as disposable: a failed write is warned and
 * swallowed, and the beacon always answers 204 so an ad-blocked or offline
 * client never sees an error it can do nothing about.
 */

const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { asyncHandler, createError } = require('../middlewares/errorHandler');
const { trackEvent, CLIENT_EVENT_TYPES } = require('../utils/trackEvent');

// @route   POST /api/v1/events
// @desc    Record one traffic-stage event from the browser
// @access  Public (rate-limited, no PII accepted)
exports.recordClientEvent = asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name : null;

  // Silently ignore anything not on the client allowlist rather than 400ing:
  // a stale bundle emitting a renamed stage should not spray errors into the
  // console of a member who is trying to use the site.
  if (name && CLIENT_EVENT_TYPES.includes(name)) {
    // Deliberately not awaited on the response path, and deliberately without
    // the user id — traffic stages are volume counters, not per-account facts.
    trackEvent(null, name);
  }

  res.status(204).end();
});

/**
 * The funnel, in order, with counts for a window.
 *
 * Two windows so a number can be read as a trend rather than a total: the
 * requested period, and the same length immediately before it.
 */
const FUNNEL = [
  { key: 'landing_view', label: 'Visited the site' },
  { key: 'signup_started', label: 'Started signing up' },
  { key: 'otp_send_attempted', label: 'Asked for an OTP' },
  { key: 'otp_verify_succeeded', label: 'Verified the OTP' },
  { key: 'account_created', label: 'Account created' },
  { key: 'profile_60pct', label: 'Profile 60% complete' },
  { key: 'first_interest_sent', label: 'Sent a first interest' },
  { key: 'plans_viewed', label: 'Viewed the plans' },
  { key: 'checkout_started', label: 'Started checkout' },
];

// @route   GET /api/v1/admin/funnel?days=30
// @desc    Funnel counts for the window, plus the window before it
// @access  Private/Admin (scope: users)
exports.getFunnel = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);

  const rows = await sequelize.query(
    `SELECT "eventType",
            count(*) FILTER (WHERE "createdAt" >= NOW() - (:days || ' days')::interval) AS current,
            count(*) FILTER (WHERE "createdAt" >= NOW() - (:prev || ' days')::interval
                               AND "createdAt" <  NOW() - (:days || ' days')::interval) AS previous
       FROM "AnalyticsEvents"
      WHERE "createdAt" >= NOW() - (:prev || ' days')::interval
      GROUP BY "eventType"`,
    { replacements: { days, prev: days * 2 }, type: QueryTypes.SELECT }
  );

  const byType = new Map(rows.map((r) => [r.eventType, r]));
  const stages = FUNNEL.map(({ key, label }) => ({
    key,
    label,
    count: Number(byType.get(key)?.current || 0),
    previous: Number(byType.get(key)?.previous || 0),
  }));

  // Paid conversion is not an AnalyticsEvents stage — it is a fact about the
  // Subscriptions table, and reading it from there means it can never disagree
  // with revenue.
  const [paid] = await sequelize.query(
    `SELECT count(*) FILTER (WHERE "createdAt" >= NOW() - (:days || ' days')::interval) AS current,
            count(*) FILTER (WHERE "createdAt" >= NOW() - (:prev || ' days')::interval
                               AND "createdAt" <  NOW() - (:days || ' days')::interval) AS previous
       FROM "Subscriptions"
      WHERE "razorpayPaymentId" IS NOT NULL`,
    { replacements: { days, prev: days * 2 }, type: QueryTypes.SELECT }
  );
  stages.push({
    key: 'paid',
    label: 'Paid',
    count: Number(paid?.current || 0),
    previous: Number(paid?.previous || 0),
  });

  res.json({ success: true, days, stages });
});

// @route   GET /api/v1/admin/audit-log
// @desc    Privileged actions, newest first
// @access  Private/Admin (scope: team)
exports.getAuditLog = asyncHandler(async (req, res) => {
  const { AuditLog, User, Profile } = require('../models');
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const where = {};
  if (req.query.action) where.action = String(req.query.action).slice(0, 64);

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [
      { model: User, as: 'Actor', attributes: ['id', 'email', 'role'], include: [{ model: Profile, attributes: ['firstName', 'lastName'] }] },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  res.json({
    success: true,
    entries: rows,
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
  });
});

exports.FUNNEL = FUNNEL;
