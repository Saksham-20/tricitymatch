'use strict';

/**
 * Reminder-mail opt-out. Public and unauthenticated by design: the person
 * clicking may be logged out, on another device, or a mailbox provider's
 * server acting on the member's behalf (RFC 8058 one-click). The signed link
 * (utils/emailUnsubscribe.js) is the whole credential.
 *
 * Scope of the opt-out: the nudges and promotional mail — checkout follow-up,
 * photo reminder, win-back, weekly digest. It does NOT stop mail about the
 * member's own account and money (payment problems, renewal and expiry dates,
 * security alerts, OTPs, receipts), and the page says so.
 */

const { asyncHandler, createError } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');
const config = require('../config/env');
const { verifyToken, isWellFormed } = require('../utils/emailUnsubscribe');
const { patchUserLedger } = require('../utils/userLedger');

// The link may arrive in the query string (the List-Unsubscribe header URL,
// which Gmail POSTs to) or in a JSON body (our own confirmation page).
const readLink = (req) => {
  const u = req.query.u ?? req.body?.u;
  const t = req.query.t ?? req.body?.t;
  if (!verifyToken(u, t)) {
    throw createError.badRequest('This link is not valid. Open the latest email from us and try again.');
  }
  return u;
};

exports.unsubscribe = asyncHandler(async (req, res) => {
  const userId = readLink(req);
  await patchUserLedger(userId, { emailOptOut: new Date().toISOString() });
  logAudit('email_opt_out', userId, { via: req.query.u ? 'link' : 'page' });
  res.json({ success: true, unsubscribed: true });
});

exports.resubscribe = asyncHandler(async (req, res) => {
  const userId = readLink(req);
  await patchUserLedger(userId, {}, ['emailOptOut']);
  logAudit('email_opt_in', userId, {});
  res.json({ success: true, unsubscribed: false });
});

// A browser that opens the header URL with GET (some clients do) lands on the
// confirmation page instead of silently unsubscribing. Only ever redirects to
// our own frontend, and only with a well-formed link.
exports.openConfirmation = (req, res) => {
  const { u, t } = req.query;
  const base = `${config.server.frontendUrl}/unsubscribe`;
  if (!isWellFormed(u, t)) {
    log.debug('Unsubscribe GET with malformed link');
    return res.redirect(302, base);
  }
  return res.redirect(302, `${base}?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`);
};
