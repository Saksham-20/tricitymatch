/**
 * Verification Routes
 * Photo (selfie) verification + selfie liveness.
 * Government-ID document collection removed 2026-07-02 — we only review selfies
 * against the member's own profile photos.
 * Background-check tier removed 2026-07-07 — we are a matrimony service, not a
 * screening authority.
 */

const express = require('express');
const router = express.Router();
const { submitVerification, getVerificationStatus } = require('../controllers/verificationController');
const { auth } = require('../middlewares/auth');
const { uploadDocuments, validateUploadedFiles } = require('../middlewares/upload');
const { asyncHandler, AppError } = require('../middlewares/errorHandler');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { uploadLimiter } = require('../middlewares/security');
const { submitVerificationValidation } = require('../validators');
const { Verification } = require('../models');
const { log } = require('../middlewares/logger');
const { notify } = require('../utils/notifyUser');

// All verification routes require authentication
router.use(auth);

// Get verification status (selfie fields)
router.get('/status', getVerificationStatus);

// Submit a selfie for photo verification (multipart field: selfiePhoto)
router.post('/submit',
  uploadLimiter,
  uploadDocuments,
  validateUploadedFiles,
  submitVerificationValidation,
  handleValidationErrors,
  submitVerification
);

// ── APP-052: Selfie Liveness Check ───────────────────────────────────────────

// POST /verification/selfie — submit selfie liveness video
router.post('/selfie', uploadLimiter, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const selfieVideoUrl = req.file?.path || req.body.stubVideoUrl || null;

  if (!selfieVideoUrl) {
    throw new AppError('selfieVideo file required', 400);
  }

  let verification = await Verification.findOne({ where: { userId } });
  if (!verification) {
    verification = await Verification.create({ userId, selfieVideoUrl, selfieStatus: 'pending' });
  } else {
    await verification.update({ selfieVideoUrl, selfieStatus: 'pending' });
  }

  if (process.env.NODE_ENV !== 'production') {
    setTimeout(async () => {
      try {
        await verification.update({ selfieStatus: 'passed' });
        await notify(userId, 'system', 'Selfie verified', 'Your selfie liveness check passed.');
      } catch (err) {
        log.warn('Selfie auto-approve failed', { error: err.message });
      }
    }, 3000);
  }

  res.json({
    success: true,
    message: 'Selfie submitted for liveness check',
    selfieStatus: 'pending',
  });
}));

module.exports = router;
