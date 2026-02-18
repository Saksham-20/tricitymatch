/**
 * Verification Controller
 * Handles identity verification submissions
 */

const { Verification, User } = require('../models');
const { createError, asyncHandler } = require('../middlewares/errorHandler');

// @route   POST /api/verification/submit
// @desc    Submit identity verification documents
// @access  Private
exports.submitVerification = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { documentType } = req.body;

  // Check if verification already exists
  let verification = await Verification.findOne({ where: { userId } });

  if (verification && verification.status === 'pending') {
    throw createError.conflict('Verification already submitted and pending review');
  }

  if (verification && verification.status === 'approved') {
    throw createError.conflict('You are already verified');
  }

  // Handle file uploads - Cloudinary returns full URL in file.path
  const documentFront = req.files?.documentFront?.[0]?.path || null;
  const documentBack = req.files?.documentBack?.[0]?.path || null;
  const selfiePhoto = req.files?.selfiePhoto?.[0]?.path || null;

  if (!documentFront || !selfiePhoto) {
    throw createError.badRequest('Document front and selfie photo are required');
  }

  if (verification) {
    // Update existing verification (resubmission after rejection)
    verification.documentType = documentType;
    verification.documentFront = documentFront;
    verification.documentBack = documentBack;
    verification.selfiePhoto = selfiePhoto;
    verification.status = 'pending';
    verification.adminNotes = null;
    verification.verifiedAt = null;
    verification.verifiedBy = null;
    await verification.save();
  } else {
    // Create new verification
    verification = await Verification.create({
      userId,
      documentType,
      documentFront,
      documentBack,
      selfiePhoto,
      status: 'pending'
    });
  }

  res.json({
    success: true,
    message: 'Verification documents submitted successfully. Awaiting admin approval.',
    verification: {
      id: verification.id,
      status: verification.status,
      documentType: verification.documentType,
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
    attributes: ['status', 'documentType', 'adminNotes', 'verifiedAt', 'createdAt']
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
      documentType: verification.documentType,
      adminNotes: verification.status === 'rejected' ? verification.adminNotes : null,
      verifiedAt: verification.verifiedAt,
      submittedAt: verification.createdAt
    }
  });
});
