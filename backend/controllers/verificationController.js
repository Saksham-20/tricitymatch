/**
 * Verification Controller
 * Photo (selfie) verification — a member submits a clear selfie, an admin
 * matches it against their profile photos and approves/rejects.
 *
 * Government-ID document collection was removed (2026-07-02): we are not a
 * government authority and do not ask members for identity documents. The
 * legacy documentType/documentFront/documentBack columns remain on the model
 * for old rows but are no longer written.
 */

const { Verification, Profile } = require('../models');
const config = require('../config/env');
const { startSession, consumeSession } = require('../utils/captureSession');
const { signMediaUrl, TTL } = require('../utils/privateMedia');
const { createError, asyncHandler } = require('../middlewares/errorHandler');

// @route   POST /api/verification/capture-session
// @desc    Start a capture session. The client calls this when the camera opens and
//          sends the token back as X-Capture-Token with the selfie.
// @access  Private
exports.startCaptureSession = asyncHandler(async (req, res) => {
  const { token, expiresInSeconds } = await startSession(req.user.id);
  res.json({ success: true, captureToken: token, expiresInSeconds });
});

// Runs BEFORE the upload middleware: a submission that cannot be accepted must
// not first be streamed to Cloudinary (it would sit there, orphaned).
//   1. the member has a profile photo for the reviewer to compare against
//   2. the selfie came out of a capture session this server started
exports.precheckSubmission = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ where: { userId: req.user.id }, attributes: ['profilePhoto'] });
  if (!profile?.profilePhoto) {
    throw createError.badRequest('Add a profile photo first — your selfie is compared with it.');
  }

  if (config.verification.requireCaptureToken) {
    const result = await consumeSession(req.user.id, req.get('x-capture-token'));
    if (!result.ok) {
      throw createError.badRequest(
        result.reason === 'too_fast'
          ? 'That was too quick. Take the selfie with your camera and try again.'
          : 'Your camera session expired. Open the camera again and retake the selfie.'
      );
    }
  }
  next();
});

// @route   POST /api/verification/submit
// @desc    Submit a selfie for photo verification
// @access  Private
exports.submitVerification = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Check if verification already exists
  let verification = await Verification.findOne({ where: { userId } });

  if (verification && verification.status === 'pending') {
    throw createError.conflict('Verification already submitted and pending review');
  }

  if (verification && verification.status === 'approved') {
    throw createError.conflict('You are already verified');
  }

  // A flagged row is with staff for a closer look. Resubmitting would reset it
  // to pending and wipe the flag, so the member could undo it themselves.
  if (verification && verification.status === 'flagged') {
    throw createError.conflict('Your verification is under review by our team');
  }

  // Cloudinary returns the full URL in file.path. Any documentFront/Back files
  // a stale client still sends are deliberately ignored — never stored.
  const selfiePhoto = req.files?.selfiePhoto?.[0]?.path || null;

  if (!selfiePhoto) {
    throw createError.badRequest('A selfie photo is required');
  }

  if (verification) {
    // Update existing verification (resubmission after rejection)
    verification.selfiePhoto = selfiePhoto;
    verification.status = 'pending';
    verification.adminNotes = null;
    verification.verifiedAt = null;
    verification.verifiedBy = null;
    await verification.save();
  } else {
    verification = await Verification.create({
      userId,
      selfiePhoto,
      status: 'pending'
    });
  }

  res.json({
    success: true,
    message: 'Selfie submitted successfully. Awaiting review.',
    verification: {
      id: verification.id,
      status: verification.status,
      createdAt: verification.createdAt
    }
  });
});

// @route   GET /api/verification/status
// @desc    Get verification status for current user
// @access  Private
exports.getVerificationStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const verification = await Verification.findOne({
    where: { userId },
    attributes: ['status', 'selfiePhoto', 'adminNotes', 'verifiedAt', 'createdAt']
  });

  if (!verification) {
    return res.json({
      success: true,
      verification: {
        status: 'not_submitted'
      }
    });
  }

  res.json({
    success: true,
    verification: {
      status: verification.status,
      // Identity evidence: a short-lived link, never the stored asset URL.
      selfiePhoto: signMediaUrl(verification.selfiePhoto, TTL.selfie),
      adminNotes: verification.status === 'rejected' ? verification.adminNotes : null,
      // Only an approval is a "verified at"; the column records any decision.
      verifiedAt: verification.status === 'approved' ? verification.verifiedAt : null,
      submittedAt: verification.createdAt
    }
  });
});
