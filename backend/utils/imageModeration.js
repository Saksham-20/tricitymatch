'use strict';

/**
 * Photo screening and the human review queue behind it (audit P1-6).
 *
 * Flow:
 *   upload -> screen each NEW photo -> clean: goes live as before
 *                                   -> flagged: HELD (kept off the profile) and a
 *                                      MediaReview row is opened for staff
 *   staff approve -> photo goes live      staff reject -> photo deleted, member told
 *
 * Providers (IMAGE_MODERATION_PROVIDER):
 *   off         nothing is screened (default; the queue still serves reports)
 *   cloudinary  Cloudinary "Rekognition AI Moderation" add-on. The account must
 *               be subscribed; without it every call errors and we fail OPEN.
 *   stub        dev/tests: flags any URL containing "flag-test"
 *
 * Fail-open on purpose: a provider outage must not stop a member finishing
 * onboarding. A screening error is logged and the photo goes live, as it did
 * before screening existed. Reports and staff review remain the backstop.
 */

const cloudinary = require('cloudinary').v2;
const config = require('../config/env');
const { log } = require('../middlewares/logger');
const { parseCloudinaryAsset } = require('./cloudinaryAsset');

/** @returns {Promise<{flagged: boolean, labels: string[]}>} */
const providers = {
  off: async () => ({ flagged: false, labels: [] }),

  stub: async (url) => (/flag-test/i.test(url)
    ? { flagged: true, labels: ['stub:flagged'] }
    : { flagged: false, labels: [] }),

  cloudinary: async (url) => {
    const asset = parseCloudinaryAsset(url);
    if (!asset || asset.kind !== 'cloudinary') return { flagged: false, labels: [] };
    if (!config.cloudinary.isConfigured()) return { flagged: false, labels: [] };
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    });
    const res = await cloudinary.uploader.explicit(asset.publicId, {
      type: asset.type,
      resource_type: 'image',
      moderation: 'aws_rek',
    });
    const verdict = (res.moderation || [])[0];
    if (!verdict) return { flagged: false, labels: [] };
    // 'pending' means the add-on has not decided: hold it for a human.
    if (verdict.status === 'rejected' || verdict.status === 'pending') {
      const labels = (verdict.response?.moderation_labels || []).map((l) => l.name).filter(Boolean);
      return { flagged: true, labels: labels.length ? labels : [`cloudinary:${verdict.status}`] };
    }
    return { flagged: false, labels: [] };
  },
};

const providerName = () => (providers[config.moderation?.provider] ? config.moderation.provider : 'off');

/**
 * Screen new photos. Never throws: a provider error means "not flagged".
 * @returns {Promise<Array<{url:string, flagged:boolean, labels:string[]}>>}
 */
const screenPhotos = async (urls) => {
  const name = providerName();
  const screen = providers[name];
  const out = [];
  for (const url of urls) {
    try {
      const verdict = await screen(url);
      out.push({ url, ...verdict });
    } catch (err) {
      log.warn('[moderation] screening failed, photo not held', { provider: name, error: err.message });
      out.push({ url, flagged: false, labels: [] });
    }
  }
  return out;
};

/**
 * Split freshly uploaded photos into what may go live and what is held, and open
 * a review for each held one.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string[]} args.newUrls        URLs uploaded in this request
 * @param {string|null} args.profilePhoto the URL chosen as profile photo (may be one of newUrls)
 * @param {object} args.MediaReview       model (injected for tests)
 * @returns {Promise<{ held: string[], heldReviews: object[] }>}
 */
const holdFlaggedPhotos = async ({ userId, newUrls, profilePhoto, MediaReview, transaction }) => {
  if (!newUrls.length || providerName() === 'off') return { held: [], heldReviews: [] };
  const verdicts = await screenPhotos(newUrls);
  const flagged = verdicts.filter((v) => v.flagged);
  const heldReviews = [];
  for (const v of flagged) {
    heldReviews.push(await MediaReview.create({
      userId,
      url: v.url,
      source: 'auto',
      status: 'pending',
      provider: providerName(),
      labels: v.labels,
      wasProfilePhoto: v.url === profilePhoto,
    }, { transaction }));
  }
  return { held: flagged.map((v) => v.url), heldReviews };
};

module.exports = { screenPhotos, holdFlaggedPhotos, providerName, providers };
