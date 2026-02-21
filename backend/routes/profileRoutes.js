/**
 * Profile Routes
 * Profile management endpoints with validation and rate limiting
 */

const express = require('express');
const router = express.Router();
const { 
  getMyProfile, 
  updateProfile, 
  getProfile, 
  getProfileStats, 
  deletePhoto, 
  deleteProfilePhoto 
} = require('../controllers/profileController');
const { auth, verifyTargetUser } = require('../middlewares/auth');
const { uploadPhotos, validateUploadedFiles } = require('../middlewares/upload');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { profileUpdateLimiter, uploadLimiter } = require('../middlewares/security');
const { updateProfileValidation, getProfileValidation, deletePhotoValidation } = require('../validators');

// ==================== OWN PROFILE ROUTES ====================

// Get own profile
router.get('/me', auth, getMyProfile);

// Ensure body exists after multer (multipart-only requests can leave req.body undefined)
const ensureBody = (req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
};

// Update own profile (with optional file uploads)
router.put('/me', 
  auth, 
  profileUpdateLimiter,
  uploadPhotos,
  ensureBody,
  validateUploadedFiles,
  updateProfileValidation,
  handleValidationErrors,
  updateProfile
);

// Get profile stats
router.get('/me/stats', auth, getProfileStats);

// Delete a gallery photo
router.delete('/me/photo', 
  auth,
  deletePhotoValidation,
  handleValidationErrors,
  deletePhoto
);

// Delete profile photo
router.delete('/me/profile-photo', auth, deleteProfilePhoto);

// ==================== OTHER USER PROFILE ROUTES ====================

// Get another user's profile (with privacy checks)
router.get('/:userId', 
  auth,
  getProfileValidation,
  handleValidationErrors,
  getProfile
);

module.exports = router;
