'use strict';

/**
 * Private media: selfies, voice notes and video intros.
 *
 * These are uploaded with Cloudinary delivery type `authenticated`, so the
 * stored URL is NOT a usable public link. Whenever one leaves the server it is
 * exchanged for a short-lived download URL (expires_at is enforced by
 * Cloudinary; the endpoint honours Range requests, so audio/video seek).
 *
 * Assets uploaded before this change are ordinary `upload` URLs; those pass
 * through unchanged until scripts/migrate-private-media.js converts them.
 */

const cloudinary = require('cloudinary').v2;
const config = require('../config/env');
const { parseCloudinaryAsset } = require('./cloudinaryAsset');

const DELIVERY_TYPE = 'authenticated';

// How long a URL we hand out stays valid.
const TTL = {
  selfie: 10 * 60,          // staff review / owner status page, fetched on demand
  playback: 2 * 60 * 60,    // voice notes and video intros a client may keep open
};

const formatOf = (url) => {
  try {
    const last = new URL(url).pathname.split('/').pop() || '';
    const m = last.match(/\.([A-Za-z0-9]+)$/);
    return m ? m[1].toLowerCase() : undefined;
  } catch {
    return undefined;
  }
};

let configured = false;
const ensureConfigured = () => {
  if (configured) return true;
  if (!config.cloudinary.isConfigured()) return false;
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
  configured = true;
  return true;
};

/**
 * Turn a stored media URL into one that is safe to send to a client.
 * Non-Cloudinary, legacy public and already-signed values are returned as-is.
 */
const signMediaUrl = (storedUrl, ttlSeconds = TTL.playback, now = Date.now()) => {
  if (!storedUrl || typeof storedUrl !== 'string') return storedUrl;
  const asset = parseCloudinaryAsset(storedUrl);
  if (!asset || asset.kind !== 'cloudinary' || asset.type !== DELIVERY_TYPE) return storedUrl;
  if (!ensureConfigured()) return storedUrl;
  return cloudinary.utils.private_download_url(asset.publicId, formatOf(storedUrl), {
    resource_type: asset.resourceType,
    type: asset.type,
    expires_at: Math.floor(now / 1000) + ttlSeconds,
  });
};

/** Copy of `obj` with the named fields signed. `fields` maps key -> ttl seconds. */
const withSignedMedia = (obj, fields) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const [key, ttl] of Object.entries(fields)) {
    if (out[key]) out[key] = signMediaUrl(out[key], ttl);
  }
  return out;
};

/**
 * Wrap a model's toJSON so the named fields are signed on serialisation only.
 * The attribute itself stays the stored URL, so deletes and comparisons in
 * server code keep working.
 */
const signOnSerialize = (Model, fields) => {
  const original = Model.prototype.toJSON;
  Model.prototype.toJSON = function toJSON() {
    const base = original ? original.call(this) : { ...this.get() };
    return withSignedMedia(base, fields);
  };
};

module.exports = { DELIVERY_TYPE, TTL, signMediaUrl, withSignedMedia, signOnSerialize };
