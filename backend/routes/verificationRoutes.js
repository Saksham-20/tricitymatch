/**
 * Verification Routes
 * Photo (selfie) verification — one live selfie, reviewed by an admin against
 * the member's own profile photos.
 *
 * Government-ID document collection removed 2026-07-02 — we do not ask members
 * for identity documents.
 * Background-check tier removed 2026-07-07 — we are a matrimony service, not a
 * screening authority.
 * Selfie-liveness route (`POST /selfie`, APP-052) removed 2026-08-11 — it was
 * mounted with no upload middleware, so `req.file` was always undefined and the
 * route could only ever answer 400; nothing read the `selfieStatus` /
 * `selfieVideoUrl` it wrote, and no badge anywhere derived from them. The RN
 * "Video Verified Badge" screen it backed is gone with it. The two columns stay
 * on the model as dormant, matching how the govt-ID columns were retired.
 */

const express = require('express');
const router = express.Router();
const { submitVerification, getVerificationStatus } = require('../controllers/verificationController');
const { auth } = require('../middlewares/auth');
const { uploadDocuments, validateUploadedFiles } = require('../middlewares/upload');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { uploadLimiter } = require('../middlewares/security');
const { submitVerificationValidation } = require('../validators');

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

module.exports = router;
