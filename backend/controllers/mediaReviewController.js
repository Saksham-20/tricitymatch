'use strict';

/**
 * Staff side of photo moderation (audit P1-6). See utils/imageModeration.
 */

const { Op } = require('sequelize');
const { Profile, MediaReview, Verification } = require('../models');
const sequelize = require('../config/database');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');
const { deleteFromCloudinary } = require('../middlewares/upload');
const { notify } = require('../utils/notifyUser');
const { revalidateVerification } = require('../utils/verificationFingerprint');

const STATUSES = ['pending', 'approved', 'rejected'];

// GET /api/v1/admin/media-reviews?status=pending&source=auto|report
exports.listMediaReviews = asyncHandler(async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : 'pending';
  const where = { status };
  if (['auto', 'report'].includes(req.query.source)) where.source = req.query.source;

  const reviews = await MediaReview.findAll({ where, order: [['createdAt', 'ASC']], limit: 100 });
  const profiles = await Profile.findAll({
    where: { userId: { [Op.in]: [...new Set(reviews.map((r) => r.userId))] } },
    attributes: ['userId', 'firstName', 'lastName', 'city'],
    raw: true,
  });
  const byUser = new Map(profiles.map((p) => [p.userId, p]));

  res.json({
    success: true,
    reviews: reviews.map((r) => ({ ...r.toJSON(), member: byUser.get(r.userId) || null })),
  });
});

const removeUrl = (profile, url) => {
  const photos = (profile.photos || []).filter((u) => u !== url);
  profile.photos = photos;
  if (profile.profilePhoto === url) profile.profilePhoto = photos[0] || null;
};

// PUT /api/v1/admin/media-reviews/:id   { decision: 'approve'|'reject', note }
exports.decideMediaReview = asyncHandler(async (req, res) => {
  const { decision, note } = req.body;
  const maxPhotos = config.upload.maxGalleryPhotos || 6;
  let mainLeftAlone = false;

  const result = await sequelize.transaction(async (t) => {
    const review = await MediaReview.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!review) throw createError.notFound('Review not found');
    if (review.status !== 'pending') throw createError.conflict('This photo has already been decided');

    const profile = await Profile.findOne({ where: { userId: review.userId }, transaction: t, lock: t.LOCK.UPDATE });

    if (decision === 'approve') {
      // A HELD photo now goes live. (A reported photo never left the profile.)
      if (review.source === 'auto' && profile) {
        const photos = profile.photos || [];
        if (!photos.includes(review.url) && photos.length >= maxPhotos) {
          // Approving would silently drop the photo yet tell the member it is live.
          throw createError.conflict(
            'This member\'s gallery is full, so the photo cannot go live. Reject it (they can re-upload after removing one) or wait for them to free a slot.',
            'GALLERY_FULL'
          );
        }
        if (!photos.includes(review.url)) {
          profile.photos = [...photos, review.url];
          // It becomes the main photo only when the member has none. A member
          // who uploaded it AS their main photo kept their old one during the
          // review and may have chosen another since; overriding that choice
          // days later would undo a decision they made. They are told it is in
          // their photos and can make it main themselves.
          if (!profile.profilePhoto) profile.profilePhoto = review.url;
          else if (review.wasProfilePhoto) mainLeftAlone = true;
          await profile.save({ transaction: t });
        }
      }
    } else if (profile) {
      // Reject: gone from the profile for good (held photos were never on it).
      removeUrl(profile, review.url);
      await profile.save({ transaction: t });
    }

    review.status = decision === 'approve' ? 'approved' : 'rejected';
    review.decidedBy = req.user.id;
    review.decisionNote = note || null;
    review.decidedAt = new Date();
    await review.save({ transaction: t });
    return review;
  });

  // Removing a member's main photo changes what their verification vouched for,
  // and so does approving a held photo that becomes the main one (PROF-20).
  // A no-op when the fingerprint still matches.
  revalidateVerification(result.userId, { Verification, Profile, notify, log })
    .catch((err) => log.error('Verification re-check failed', { error: err.message, reviewId: result.id }));

  if (decision === 'reject') {
    // Outside the transaction: a Cloudinary hiccup must not undo the decision.
    deleteFromCloudinary(result.url).catch((err) => log.error('Rejected photo delete failed', { error: err.message, reviewId: result.id }));
  }

  notify(
    result.userId,
    'system',
    decision === 'approve' ? 'Your photo is live' : 'A photo was removed',
    decision === 'approve'
      ? (mainLeftAlone
        ? 'Our team reviewed your photo and it is now in your photos. To show it first, open Edit profile, then Photos, and choose Make main.'
        : 'Our team reviewed your photo and it now appears on your profile.')
      : `A photo was removed from your profile after review.${note ? ` ${note}` : ''} You can upload another clear photo of yourself.`
  ).catch((err) => log.error('Photo decision notification failed', { error: err.message }));

  logAudit('media_review_decided', req.user.id, { reviewId: result.id, memberId: result.userId, decision, source: result.source });
  res.json({ success: true, review: result });
});
