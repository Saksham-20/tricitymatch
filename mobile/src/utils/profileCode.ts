/**
 * Public profile code — `TCS-XXXXXXXX`, derived from the first UUID segment of
 * a userId. Members share it offline ("my ID is TCS-A1B2C3D4") and look it up
 * through search.
 *
 * Ported from backend/utils/profileCode.js. The derivation must match the
 * server's exactly, because `GET /search/by-code` parses the code back into a
 * userId range — a code this app renders that the server cannot parse is a
 * dead ID printed on a member's screen. profileCode.test.ts pins the two
 * implementations against each other by requiring the backend module and
 * comparing outputs, rather than restating the format here.
 */

const PREFIX = 'TCS';
const HEX8 = /^[0-9a-f]{8}$/i;

/** userId (UUID) → public code, e.g. `a1b2c3d4-…` → `TCS-A1B2C3D4`. */
export const toProfileCode = (userId?: string | null): string | null => {
  if (!userId || typeof userId !== 'string') return null;
  const seg = userId.split('-')[0];
  if (!HEX8.test(seg)) return null;
  return `${PREFIX}-${seg.toUpperCase()}`;
};

/**
 * Parse a member-typed code (any case, optional prefix/dash/whitespace) to the
 * lowercase 8-hex userId prefix, or null if it cannot be a valid code. Used to
 * reject obvious typos before spending a rate-limited search request.
 */
export const parseProfileCode = (input?: string | null): string | null => {
  if (!input || typeof input !== 'string') return null;
  let s = input.trim().toUpperCase().replace(/\s+/g, '');
  if (s.startsWith(`${PREFIX}-`)) s = s.slice(PREFIX.length + 1);
  else if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
  s = s.replace(/^-+/, '');
  if (!HEX8.test(s)) return null;
  return s.toLowerCase();
};

/** Render an already-parsed 8-hex prefix back as a display code. */
export const formatProfileCode = (prefix: string): string => `${PREFIX}-${prefix.toUpperCase()}`;

export { PREFIX as PROFILE_CODE_PREFIX };
