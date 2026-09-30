'use strict';

/**
 * Parse a stored media URL into what is needed to delete it.
 *
 * Kept pure (no Cloudinary SDK, no config) so it is unit-testable and can be
 * shared by every caller. The old parser returned only a public_id, so every
 * delete was sent with Cloudinary's default resource_type of `image` — voice
 * notes and video intros are stored as `video`, and destroying them as images
 * answers "not found" and silently leaves the media live.
 *
 * Cloudinary delivery URLs carry all of it:
 *   https://res.cloudinary.com/<cloud>/<resource_type>/<type>/[transforms/]v123/<folder>/<id>.<ext>
 *
 * Returns:
 *   { kind: 'cloudinary', publicId, resourceType, type }
 *   { kind: 'local', file }          for the /uploads disk fallback
 *   null                             for anything else (external URL, junk)
 */

const RESOURCE_TYPES = ['image', 'video', 'raw'];
const DELIVERY_TYPES = ['upload', 'authenticated', 'private'];

const parseCloudinaryAsset = (url) => {
  if (!url || typeof url !== 'string') return null;

  // Disk fallback used when Cloudinary is not configured: /uploads/<sub>/<file>
  if (url.startsWith('/uploads/')) {
    const rel = url.slice('/uploads/'.length);
    if (!rel || rel.includes('..')) return null;
    return { kind: 'local', file: rel };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)cloudinary\.com$/i.test(parsed.hostname)) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  // [cloudName, resourceType, deliveryType, ...rest]
  const resourceType = segments[1];
  const type = segments[2];
  if (!RESOURCE_TYPES.includes(resourceType) || !DELIVERY_TYPES.includes(type)) return null;

  const rest = segments.slice(3);
  const versionIdx = rest.findIndex((s) => /^v\d+$/.test(s));
  // With a version segment, everything after it is the public_id. Without one,
  // drop leading transformation segments (they contain commas, e.g. c_fill,w_500).
  const idSegments = versionIdx >= 0 ? rest.slice(versionIdx + 1) : rest.filter((s) => !s.includes(','));
  if (idSegments.length === 0) return null;

  let publicId;
  try {
    publicId = decodeURIComponent(idSegments.join('/'));
  } catch {
    return null;
  }
  // image/video public_ids exclude the extension; raw ones include it.
  if (resourceType !== 'raw') publicId = publicId.replace(/\.[^./]+$/, '');
  if (!publicId) return null;

  return { kind: 'cloudinary', publicId, resourceType, type };
};

module.exports = { parseCloudinaryAsset };
