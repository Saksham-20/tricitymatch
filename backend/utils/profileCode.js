/**
 * Public profile code — a short, shareable ID derived deterministically from a
 * user's UUID. Lets members share a profile offline ("my ID is TCS-A1B2C3D4")
 * and look it up via search, matching the profile-ID search competitors offer.
 *
 * Format: `TCS-XXXXXXXX` where XXXXXXXX = first UUID segment (8 hex), uppercased.
 * Deterministic + reversible to a userId prefix, so no DB column/migration is
 * needed. 8 hex = ~4.3B space — collision-safe for a hyperlocal user base.
 */

const PREFIX = 'TCS';
const HEX8 = /^[0-9a-f]{8}$/i;

// userId (UUID) → public code, e.g. "a1b2c3d4-..." → "TCS-A1B2C3D4"
const toProfileCode = (userId) => {
  if (!userId || typeof userId !== 'string') return null;
  const seg = userId.split('-')[0];
  if (!HEX8.test(seg)) return null;
  return `${PREFIX}-${seg.toUpperCase()}`;
};

// Parse a user-entered code (any case, optional prefix/dash/whitespace) to the
// lowercase 8-hex userId prefix, or null if it can't be a valid code.
const parseProfileCode = (input) => {
  if (!input || typeof input !== 'string') return null;
  let s = input.trim().toUpperCase().replace(/\s+/g, '');
  if (s.startsWith(`${PREFIX}-`)) s = s.slice(PREFIX.length + 1);
  else if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
  s = s.replace(/^-+/, '');
  if (!HEX8.test(s)) return null;
  return s.toLowerCase();
};

module.exports = { toProfileCode, parseProfileCode, PREFIX };
