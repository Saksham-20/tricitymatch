'use strict';

/**
 * Signed unsubscribe links for reminder / promotional mail.
 *
 * The link IS the credential: an HMAC of the member id under the server
 * secret, so no token table and no expiry — an unsubscribe link has to keep
 * working in a mail someone opens a year later. It can do exactly one thing
 * (switch that member's reminder mail off, or back on), so a leaked link is
 * worth nothing else.
 *
 * Two URLs per mail:
 *  - pageUrl     the human link in the footer. Opens a confirmation page, and
 *                the page POSTs. It is deliberately not a bare GET that
 *                unsubscribes: mail-security scanners prefetch every link in a
 *                message, and would unsubscribe every recipient on delivery.
 *  - oneClickUrl the RFC 8058 endpoint for the `List-Unsubscribe` header. Gmail
 *                and Yahoo POST to it directly when the member presses their
 *                own "Unsubscribe" button.
 *
 * Rotating JWT_SECRET invalidates every link already sent.
 */

const crypto = require('crypto');
const config = require('../config/env');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_LEN = 32; // hex chars — 128 bits

const tokenFor = (userId) =>
  crypto.createHmac('sha256', config.auth.jwtSecret)
    .update(`email-unsubscribe:v1:${userId}`)
    .digest('hex')
    .slice(0, TOKEN_LEN);

const isWellFormed = (userId, token) =>
  typeof userId === 'string' && UUID_RE.test(userId)
  && typeof token === 'string' && token.length === TOKEN_LEN;

const verifyToken = (userId, token) => {
  if (!isWellFormed(userId, token)) return false;
  const expected = Buffer.from(tokenFor(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

const linksFor = (userId) => {
  const qs = `u=${encodeURIComponent(userId)}&t=${tokenFor(userId)}`;
  return {
    pageUrl: `${config.server.frontendUrl}/unsubscribe?${qs}`,
    oneClickUrl: `${config.server.frontendUrl}/api/v1/email/unsubscribe?${qs}`,
  };
};

module.exports = { tokenFor, verifyToken, isWellFormed, linksFor };
