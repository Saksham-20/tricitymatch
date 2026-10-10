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
  pauseMyProfile,
  resumeMyProfile,
  unlockContact,
  getProfileViewers,
  getRecentlyViewed,
  downloadBiodata,
  getCompatibilityBreakdown,
  getHoroscopeMatch,
  downloadKundliReport,
  uploadVoiceIntro: uploadVoiceIntroHandler,
  deleteVoiceIntro,
  uploadVideoIntro: uploadVideoIntroHandler,
  deleteVideoIntro,
} = require('../controllers/profileController');
const { auth, requirePremium, checkContactUnlockLimit, verifyTargetUser } = require('../middlewares/auth');
const { uploadPhotos, uploadLimitWhenPhotos, validateUploadedFiles, uploadVoiceIntro, uploadVideoIntro } = require('../middlewares/upload');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { profileUpdateLimiter, uploadLimiter, profileInsightLimiter, pdfLimiter } = require('../middlewares/security');
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
  // This route accepts a profile photo plus the full gallery (5 MB each), but
  // carried only the 10/min text-update limiter — ~600 uploads/hr per account.
  // uploadLimiter (20/hr) is what the dedicated media routes already use — but
  // only for saves that actually carry a photo: the app saves once per journey
  // step and the incognito/quiz toggles PUT here too, so counting text-only
  // saves locked a diligent member out after ~20 steps (PROF-09).
  uploadLimitWhenPhotos,
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

// Get profiles the current user recently viewed (all tiers — own activity)
router.get('/me/recently-viewed', auth, getRecentlyViewed);

// Download own marriage-biodata PDF (D5 — FREE for every tier; branded footer
// is the acquisition loop). ?template=classic|modern
router.get('/me/biodata', auth, pdfLimiter, downloadBiodata);

// Delete a gallery photo
router.delete('/me/photo', 
  auth,
  deletePhotoValidation,
  handleValidationErrors,
  deletePhoto
);

// Delete profile photo
router.delete('/me/profile-photo', auth, deleteProfilePhoto);

// Voice intro upload (30s max, auth required, rate limited via uploadLimiter)
router.post('/voice-intro',
  auth,
  uploadLimiter,
  uploadVoiceIntro,
  uploadVoiceIntroHandler,
);

// Delete voice intro
router.delete('/voice-intro', auth, deleteVoiceIntro);

// Video intro upload (~30s max, auth required, rate limited via uploadLimiter)
router.post('/video-intro',
  auth,
  uploadLimiter,
  uploadVideoIntro,
  uploadVideoIntroHandler,
);

// Delete video intro
router.delete('/video-intro', auth, deleteVideoIntro);

// Update privacy settings
router.put('/privacy', auth, updatePrivacySettings);

// Pause / resume: hide the profile from every listing without deleting anything.
router.post('/me/pause', auth, profileUpdateLimiter, pauseMyProfile);
router.post('/me/resume', auth, profileUpdateLimiter, resumeMyProfile);

// ==================== OTHER USER PROFILE ROUTES ====================

// Get another user's profile (with privacy checks)
router.get('/:userId', 
  auth,
  getProfileValidation,
  handleValidationErrors,
  getProfile
);

// Unlock contact details for a profile (premium only, with unlock limit check)
// getProfileValidation runs BEFORE checkContactUnlockLimit so a malformed id
// can never reach the quota-consuming handler.
router.post('/:userId/unlock-contact',
  auth,
  requirePremium,
  getProfileValidation,
  handleValidationErrors,
  checkContactUnlockLimit,
  unlockContact
);

// Compatibility breakdown (APP-049 — "Why This Match")
router.get('/:userId/compatibility',
  auth,
  profileInsightLimiter,
  getProfileValidation,
  handleValidationErrors,
  getCompatibilityBreakdown
);

// Horoscope / Ashtakoot match (APP-055)
router.get('/:userId/horoscope-match',
  auth,
  profileInsightLimiter,
  getProfileValidation,
  handleValidationErrors,
  getHoroscopeMatch
);

// Downloadable Kundli matchmaking report PDF (premium)
router.get('/:userId/horoscope-match/pdf',
  auth,
  // The heaviest read in the app: full Ashtakoot computation plus a pdfkit
  // render, streamed. The global apiLimiter would allow 200 of these per
  // 15 minutes from one address.
  pdfLimiter,
  requirePremium,
  getProfileValidation,
  handleValidationErrors,
  downloadKundliReport
);

module.exports = router;

