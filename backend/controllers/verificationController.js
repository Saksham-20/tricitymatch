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

const { Verification, User } = require('../models');
const { createError, asyncHandler } = require('../middlewares/errorHandler');

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
      selfiePhoto: verification.selfiePhoto,
      adminNotes: verification.status === 'rejected' ? verification.adminNotes : null,
      verifiedAt: verification.verifiedAt,
      submittedAt: verification.createdAt
    }
  });
});
