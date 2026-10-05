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
// @desc    Privileged actions, newest first. Filters: action, actor, target
//          (a user id OR part of an email), from/to (YYYY-MM-DD, India days).
//          `format=csv` streams the whole filtered log as a file.
// @access  Private/Admin (scope: team)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IST_OFFSET = '+05:30';
const isYmd = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const escapeLike = (v) => String(v).replace(/[%_\\]/g, '\\$&');
const AUDIT_EXPORT_BATCH = 1000;

/** Sequelize where + required joins for the audit filters in a query string. */
const auditFilters = (query) => {
  const { Op } = require('sequelize');
  const { User } = require('../models');
  const where = {};
  const joins = {};

  if (query.action) where.action = String(query.action).slice(0, 64);

  // "Who did it" / "who was it about": a pasted user id matches exactly, anything
  // else is treated as part of an email address.
  const person = (raw, idField, alias, key) => {
    const v = String(raw || '').trim().slice(0, 120);
    if (!v) return;
    if (UUID.test(v)) { where[idField] = v; return; }
    joins[key] = { model: User, as: alias, attributes: ['id', 'email', 'role'], required: true, where: { email: { [Op.iLike]: `%${escapeLike(v)}%` } } };
  };
  person(query.actor || query.actorId, 'actorId', 'Actor', 'actor');
  person(query.target || query.targetUserId, 'targetUserId', 'TargetUser', 'target');

  // Whole India calendar days, matching how the rest of the panel reads dates.
  const range = {};
  if (isYmd(query.from)) range[Op.gte] = new Date(`${query.from}T00:00:00.000${IST_OFFSET}`);
  if (isYmd(query.to)) range[Op.lte] = new Date(`${query.to}T23:59:59.999${IST_OFFSET}`);
  if (Object.getOwnPropertySymbols(range).length) where.createdAt = range;

  return { where, joins };
};

const auditIncludes = (joins) => {
  const { User, Profile } = require('../models');
  return [
    joins.actor || { model: User, as: 'Actor', attributes: ['id', 'email', 'role'], required: false, include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }] },
    joins.target || { model: User, as: 'TargetUser', attributes: ['id', 'email', 'role'], required: false },
  ];
};

exports.getAuditLog = asyncHandler(async (req, res) => {
  const { AuditLog } = require('../models');
  const { where, joins } = auditFilters(req.query);

  if (req.query.format === 'csv') {
    const { streamCsv } = require('../utils/csvStream');
    const { Op } = require('sequelize');
    const { logAudit, log } = require('../middlewares/logger');
    const total = await AuditLog.count({ where, include: Object.values(joins).map((j) => ({ ...j, attributes: [] })) });
    const when = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' });

    const result = await streamCsv(res, {
      filename: `tricitymatch-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      header: ['When (IST)', 'Action', 'By', 'By role', 'About', 'Details'],
      total,
      log,
      fetchBatch: async (cursor) => {
        const and = [where];
        if (cursor) {
          and.push({ [Op.or]: [{ createdAt: { [Op.lt]: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { [Op.lt]: cursor.id } }] });
        }
        const rows = await AuditLog.findAll({
          where: { [Op.and]: and },
          include: auditIncludes(joins),
          order: [['createdAt', 'DESC'], ['id', 'DESC']],
          limit: AUDIT_EXPORT_BATCH,
        });
        const last = rows[rows.length - 1];
        return { rows, next: rows.length === AUDIT_EXPORT_BATCH ? { createdAt: last.createdAt, id: last.id } : null };
      },
      toRow: (e) => [when(e.createdAt), e.action, e.Actor?.email || '', e.Actor?.role || '', e.TargetUser?.email || '', e.details ? JSON.stringify(e.details) : ''],
    });
    // Reading the audit trail in bulk is itself worth a line in it.
    logAudit('audit_log_exported', req.user.id, { rows: result.rows, filters: Object.keys(req.query).filter((k) => req.query[k] && k !== 'format') });
    return undefined;
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: auditIncludes(joins),
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });

  res.json({
    success: true,
    entries: rows,
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
  });
});

// @route   GET /api/v1/admin/audit-log/actions
// @desc    Every action that has been recorded, with counts, for the filter
//          dropdown (so it lists what actually exists, not a hand-kept list).
// @access  Private/Admin (scope: team)
exports.getAuditActions = asyncHandler(async (req, res) => {
  const rows = await sequelize.query(
    'SELECT "action", COUNT(*)::int AS count FROM "AuditLogs" GROUP BY "action" ORDER BY "action" ASC',
    { type: QueryTypes.SELECT }
  );
  res.json({ success: true, actions: rows });
});

exports.FUNNEL = FUNNEL;
