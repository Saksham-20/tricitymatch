'use strict';

/**
 * Find and destroy every media file a member has uploaded.
 *
 * Account erasure removed the database rows but never the files: profile and
 * gallery photos, the verification selfie and liveness video, voice and video
 * intros and voice messages all stayed on public Cloudinary URLs after the
 * member "deleted" their account. This collects the URLs BEFORE the rows go and
 * destroys the files AFTER the erasure commits.
 *
 * Order matters: the database erasure must never be blocked by a CDN outage, so
 * files are destroyed after commit and failures are reported (never thrown) for
 * the caller to log, so an operator can retry the listed public_ids.
 */

const fs = require('fs/promises');
const path = require('path');
const { parseCloudinaryAsset } = require('./cloudinaryAsset');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
};

const rows = (result) => (Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : []);

/**
 * Every media URL owned by these members. Read-only.
 * @param {object} sequelize
 * @param {string[]} userIds
 */
const collectMemberMedia = async (sequelize, userIds) => {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const replacements = { ids };
  const urls = new Set();
  const add = (v) => { if (typeof v === 'string' && v) urls.add(v); };

  const profiles = rows(await sequelize.query(
    'SELECT "profilePhoto", "photos", "voiceIntroUrl", "videoIntroUrl" FROM "Profiles" WHERE "userId" IN (:ids)',
    { replacements }
  ));
  for (const p of profiles) {
    add(p.profilePhoto);
    asArray(p.photos).forEach(add);
    add(p.voiceIntroUrl);
    add(p.videoIntroUrl);
  }

  const verifications = rows(await sequelize.query(
    'SELECT "selfiePhoto", "selfieVideoUrl", "documentFront", "documentBack" FROM "Verifications" WHERE "userId" IN (:ids)',
    { replacements }
  ));
  for (const v of verifications) {
    add(v.selfiePhoto);
    add(v.selfieVideoUrl);
    // Legacy: government-ID collection was removed but old rows may hold them.
    add(v.documentFront);
    add(v.documentBack);
  }

  // Photos held for review are not on the profile any more, but they are still
  // uploaded assets that belong to the member.
  const held = rows(await sequelize.query(
    'SELECT "url" FROM "MediaReviews" WHERE "userId" IN (:ids)',
    { replacements }
  ));
  for (const h of held) add(h.url);

  const messages = rows(await sequelize.query(
    'SELECT "mediaUrl" FROM "Messages" WHERE "senderId" IN (:ids) AND "mediaUrl" IS NOT NULL',
    { replacements }
  ));
  for (const m of messages) add(m.mediaUrl);

  return [...urls];
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Destroy the given media. Never throws.
 *
 * @param {string[]} urls
 * @param {object}  [deps]  injectable for tests: { cloudinary, isConfigured, retryDelayMs }
 * @returns {{deleted:number, alreadyGone:number, local:number, skipped:number, failed:Array}}
 */
const destroyMedia = async (urls, deps = {}) => {
  const summary = { deleted: 0, alreadyGone: 0, local: 0, skipped: 0, failed: [] };
  if (!urls || urls.length === 0) return summary;

  const upload = deps.cloudinary ? null : require('../middlewares/upload');
  const cloudinary = deps.cloudinary || upload.cloudinary;
  const config = deps.isConfigured !== undefined ? null : require('../config/env');
  const configured = deps.isConfigured !== undefined ? deps.isConfigured : config.cloudinary.isConfigured();
  const retryDelayMs = deps.retryDelayMs ?? 300;

  const work = [];
  for (const url of urls) {
    const asset = parseCloudinaryAsset(url);
    if (!asset) { summary.skipped += 1; continue; }
    work.push(asset);
  }

  const destroyOne = async (asset) => {
    if (asset.kind === 'local') {
      const target = path.resolve(UPLOADS_DIR, asset.file);
      // Stay inside the uploads directory whatever the stored value says.
      if (!target.startsWith(UPLOADS_DIR + path.sep)) { summary.skipped += 1; return; }
      try {
        await fs.unlink(target);
        summary.local += 1;
      } catch (err) {
        if (err.code === 'ENOENT') summary.alreadyGone += 1;
        else summary.failed.push({ publicId: asset.file, resourceType: 'local', error: err.code || err.message });
      }
      return;
    }

    if (!configured) { summary.skipped += 1; return; }

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          type: asset.type,
          invalidate: true,
        });
        if (result && result.result === 'ok') { summary.deleted += 1; return; }
        if (result && result.result === 'not found') { summary.alreadyGone += 1; return; }
        lastError = `unexpected result: ${result && result.result}`;
      } catch (err) {
        lastError = err && err.message ? err.message : String(err);
      }
      if (attempt < 2) await sleep(retryDelayMs * 2 ** attempt);
    }
    summary.failed.push({ publicId: asset.publicId, resourceType: asset.resourceType, error: lastError });
  };

  // Small fixed concurrency: an account with a full gallery must not open dozens
  // of simultaneous API calls.
  const queue = [...work];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) await destroyOne(queue.shift());
  });
  await Promise.all(workers);

  return summary;
};

module.exports = { collectMemberMedia, destroyMedia };
