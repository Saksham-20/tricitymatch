/**
 * Verification Routes
 * Identity verification submission endpoints
 */

const express = require('express');
const router = express.Router();
const { submitVerification, getVerificationStatus } = require('../controllers/verificationController');
const { auth } = require('../middlewares/auth');
const { uploadDocuments } = require('../middlewares/upload');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { uploadLimiter } = require('../middlewares/security');
const { submitVerificationValidation } = require('../validators');

// All verification routes require authentication
router.use(auth);

// Get verification status
router.get('/status', getVerificationStatus);

// Submit verification documents
router.post('/submit',
  uploadLimiter,
  uploadDocuments,
  submitVerificationValidation,
  handleValidationErrors,
  submitVerification
);

module.exports = router;
