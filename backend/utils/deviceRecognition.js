'use strict';

/**
 * New-device sign-in alerts and login history (audit P2).
 *
 * No table of its own: every sign-in already writes a RefreshToken row carrying
 * the user agent and IP, and rotation keeps the same `family`. A "device" here
 * is the (browser or app, operating system) pair read from that user agent; a
 * sign-in from a pair this member has no earlier session for is a new device.
 *
 * Deliberately coarse. The point is "tell the member when something they do not
 * recognise signs in", not fingerprinting: a browser update does not change the
 * pair, a different browser on the same laptop does, and that is the behaviour a
 * person expects from the email.
 *
 * History reaches as far back as RefreshToken rows survive (expired rows are
 * removed by the cleanup job 30 days after revocation), so it is a recent-activity
 * view, not a permanent ledger.
 */

const { Op } = require('sequelize');

const BROWSERS = [
  [/EdgA?\/|Edge\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const APPS = [
  [/okhttp\//i, 'TricityMatch app'],
  [/CFNetwork|Darwin\//, 'TricityMatch app'],
  [/Expo|ReactNative/i, 'TricityMatch app'],
];

const SYSTEMS = [
  [/Windows NT/, 'Windows'],
  [/iPhone|iPad|iPod|iOS|CFNetwork.*Darwin/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux|X11/, 'Linux'],
];

const first = (table, ua) => {
  for (const [re, name] of table) if (re.test(ua)) return name;
  return null;
};

/** { key, label } for a user-agent string. Unknown agents share one key. */
const describeDevice = (userAgent) => {
  const ua = String(userAgent || '');
  if (!ua) return { key: 'unknown|unknown', label: 'an unknown device' };
  // Browsers first: an app's HTTP client string never contains a browser token,
  // but a browser string can contain "Safari" and "Darwin"-like tokens.
  const browser = first(BROWSERS, ua);
  const app = browser ? null : first(APPS, ua);
  const family = browser || app || 'Unknown app';
  const os = first(SYSTEMS, ua) || (app ? 'mobile' : 'Unknown system');
  const label = os === 'Unknown system' ? family : `${family} on ${os}`;
  return { key: `${family}|${os}`.toLowerCase(), label };
};

/** 203.0.113.42 -> 203.0.x.x ; IPv6 -> first two groups. Enough to recognise, not to locate. */
const maskIp = (ip) => {
  const value = String(ip || '').replace(/^::ffff:/, '');
  if (!value) return null;
  if (value.includes(':')) return `${value.split(':').slice(0, 2).join(':')}::`;
  const parts = value.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : null;
};

const PRIOR_LIMIT = 300;

/**
 * True when this member has earlier sessions but none from this device. A
 * member's first-ever sign-in is not "new device": there is nothing to compare
 * against and they have just created the account.
 */
const isNewDevice = async (RefreshToken, { userId, sessionId, userAgent }) => {
  const prior = await RefreshToken.findAll({
    where: { userId, id: { [Op.ne]: sessionId } },
    attributes: ['userAgent'],
    order: [['createdAt', 'DESC']],
    limit: PRIOR_LIMIT,
    raw: true,
  });
  if (prior.length === 0) return false;
  const { key } = describeDevice(userAgent);
  return !prior.some((row) => describeDevice(row.userAgent).key === key);
};

/**
 * One entry per sign-in (a `family` is one login and all its rotations), newest
 * first.
 */
const loginHistory = async (RefreshToken, userId, { limit = 20 } = {}) => {
  const rows = await RefreshToken.findAll({
    where: { userId },
    attributes: ['id', 'family', 'userAgent', 'ipAddress', 'createdAt', 'lastUsedAt', 'isRevoked', 'revokedReason', 'expiresAt'],
    order: [['createdAt', 'ASC']],
    limit: 1000,
    raw: true,
  });
  const byFamily = new Map();
  for (const r of rows) {
    const entry = byFamily.get(r.family);
    if (!entry) {
      byFamily.set(r.family, { first: r, last: r });
    } else {
      entry.last = r;
    }
  }
  const now = Date.now();
  return [...byFamily.values()]
    .map(({ first: f, last: l }) => {
      const device = describeDevice(f.userAgent);
      const live = !l.isRevoked && new Date(l.expiresAt).getTime() > now;
      return {
        signedInAt: f.createdAt,
        lastActiveAt: l.lastUsedAt || l.createdAt,
        device: device.label,
        approximateIp: maskIp(f.ipAddress),
        status: live ? 'active' : 'ended',
        endedBecause: live ? null : (l.isRevoked ? (l.revokedReason || 'signed_out') : 'expired'),
      };
    })
    .sort((a, b) => new Date(b.signedInAt) - new Date(a.signedInAt))
    .slice(0, limit);
};

module.exports = { describeDevice, maskIp, isNewDevice, loginHistory };
