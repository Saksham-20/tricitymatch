/**
 * Social connections helper.
 *
 * `Profile.socialMediaLinks` (JSONB) holds member-entered social handles. The
 * shape evolved from a flat `{ instagram: "url" }` map to a per-link map with a
 * visibility choice: `{ instagram: { url, visibility } }` where
 * visibility ∈ 'everyone' | 'matches_only' | 'hidden' (default 'matches_only').
 *
 * These are DISPLAY-ONLY links — no OAuth, no ownership proof, no credibility
 * score. Verification (the selfie badge) stays the trust anchor. This module
 * only normalizes the shape and enforces the member's own visibility choice.
 *
 * Legacy rows (flat strings, seeded before the shape change) are read as
 * `{ url, visibility: 'matches_only' }` so nothing breaks and old links do not
 * suddenly become public.
 */

const PLATFORMS = ['instagram', 'linkedin', 'facebook', 'twitter', 'youtube', 'website'];
const VISIBILITIES = ['everyone', 'matches_only', 'hidden'];
const DEFAULT_VISIBILITY = 'matches_only';

// Build a safe https URL from a bare handle for a known platform.
function handleToUrl(key, handle) {
  const h = handle.replace(/^@+/, '').trim();
  if (!h) return null;
  switch (key) {
    case 'instagram': return `https://instagram.com/${h}`;
    case 'twitter':   return `https://x.com/${h}`;
    case 'facebook':  return `https://facebook.com/${h}`;
    case 'linkedin':  return `https://linkedin.com/in/${h}`;
    case 'youtube':   return `https://youtube.com/@${h}`;
    case 'website':   return `https://${h}`;
    default:          return null;
  }
}

/**
 * Turn a raw value (URL or bare handle) into a safe http(s) URL, or null if it
 * can't be made safe. Blocks javascript:/data: and other non-web schemes.
 */
function toSafeUrl(key, raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  // Anything with a scheme we didn't explicitly allow (javascript:, data:, etc.)
  // is rejected rather than treated as a handle.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  // A bare value that already looks like a domain (e.g. "facebook.com/you" or
  // "linkedin.com/in/x") is a scheme-less URL, not a handle — prepend https://
  // rather than gluing it onto the platform base (which would double the host).
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(value)) {
    try {
      const u = new URL(`https://${value}`);
      return u.toString();
    } catch {
      return null;
    }
  }

  return handleToUrl(key, value);
}

/**
 * Normalize member-submitted social links into the canonical per-link shape.
 * Accepts either the legacy flat `{ key: "url" }` map or the new
 * `{ key: { url, visibility } }` map. Drops unknown platforms, empty/unsafe
 * URLs, and clamps visibility to the allowed set.
 *
 * Returns `{ [key]: { url, visibility } }`, or null when nothing valid remains.
 */
function normalizeSocialLinks(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const out = {};
  for (const key of PLATFORMS) {
    const entry = raw[key];
    if (entry == null) continue;

    let rawUrl;
    let visibility = DEFAULT_VISIBILITY;

    if (typeof entry === 'string') {
      rawUrl = entry;
    } else if (typeof entry === 'object') {
      rawUrl = entry.url;
      if (VISIBILITIES.includes(entry.visibility)) visibility = entry.visibility;
    } else {
      continue;
    }

    const url = toSafeUrl(key, rawUrl);
    if (!url) continue;

    out[key] = { url, visibility };
  }

  return Object.keys(out).length ? out : null;
}

/**
 * Filter normalized links down to what a given viewer may see.
 * - owner sees everything (including hidden), with visibility labels
 * - everyone → always visible
 * - matches_only → visible only when the viewer is a mutual match
 * - hidden → never visible to others
 *
 * Returns `{ [key]: { url, visibility } }` or null.
 */
function visibleSocialLinks(raw, { isOwner = false, isMutual = false } = {}) {
  const normalized = normalizeSocialLinks(raw);
  if (!normalized) return null;
  if (isOwner) return normalized;

  const out = {};
  for (const [key, { url, visibility }] of Object.entries(normalized)) {
    if (visibility === 'everyone' || (visibility === 'matches_only' && isMutual)) {
      out[key] = { url, visibility };
    }
  }
  return Object.keys(out).length ? out : null;
}

module.exports = {
  PLATFORMS,
  VISIBILITIES,
  DEFAULT_VISIBILITY,
  normalizeSocialLinks,
  visibleSocialLinks,
  toSafeUrl,
};
