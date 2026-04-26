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
  deleteProfilePhoto,
  updatePrivacySettings,
  unlockContact,
  getProfileViewers,
} = require('../controllers/profileController');
const { auth, requirePremium, checkContactUnlockLimit, verifyTargetUser } = require('../middlewares/auth');
const { uploadPhotos, validateUploadedFiles } = require('../middlewares/upload');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { profileUpdateLimiter, uploadLimiter } = require('../middlewares/security');
const { updateProfileValidation, getProfileValidation, deletePhotoValidation } = require('../validators');

// ==================== OWN PROFILE ROUTES ====================

// Get own profile
router.get('/me', auth, getMyProfile);

// Ensure body exists after multer and normalize FormData primitives
const ensureBody = (req, res, next) => {
  if (req.body === undefined) req.body = {};
  
  // Normalise arrays (Multer converts single-element appends into a raw string)
  ['interestTags', 'languages', 'preferredCity'].forEach(field => {
    if (typeof req.body[field] === 'string') {
      req.body[field] = req.body[field] ? [req.body[field]] : [];
    }
  });

  // Normalise JSON strings (Frontend appends stringified objects)
  ['personalityValues', 'familyPreferences', 'lifestylePreferences', 'profilePrompts'].forEach(field => {
    if (typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (e) {
        // ignore parsing errors, validation will handle invalid objects
      }
    }
  });

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

// Get who viewed your profile (premium only)
router.get('/me/viewers', auth, requirePremium, getProfileViewers);

// Delete a gallery photo
router.delete('/me/photo', 
  auth,
  deletePhotoValidation,
  handleValidationErrors,
  deletePhoto
);

// Delete profile photo
router.delete('/me/profile-photo', auth, deleteProfilePhoto);

// Update privacy settings
router.put('/privacy', auth, updatePrivacySettings);

// ==================== OTHER USER PROFILE ROUTES ====================

// Get another user's profile (with privacy checks)
router.get('/:userId', 
  auth,
  getProfileValidation,
  handleValidationErrors,
  getProfile
);

// Unlock contact details for a profile (premium only, with unlock limit check)
router.post('/:userId/unlock-contact',
  auth,
  requirePremium,
  checkContactUnlockLimit,
  unlockContact
);

module.exports = router;

