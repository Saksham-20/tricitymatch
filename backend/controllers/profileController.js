/**
 * Profile Controller
 * Handles user profile management with proper security
 */

const { hasVerifiableAge } = require('../utils/ageVerifiable');
const { Profile, User, ProfileView, Subscription, Match, ContactUnlock, Block, Verification, MediaReview } = require('../models');
const { holdFlaggedPhotos } = require('../utils/imageModeration');
const { revalidateVerification } = require('../utils/verificationFingerprint');

// Withdraw the photo-verified badge if the photo or name it vouched for changed.
const recheckVerification = async (userId) => {
  try {
    await revalidateVerification(userId, { Verification, Profile, notify, log });
  } catch (err) {
    log.error('Verification re-check failed', { error: err.message, userId });
  }
};
const { applyIdentityRules } = require('../utils/identityLock');
const { blockedIdsFor } = require('../utils/blocks');
const { redactForViewer, stripOwnerOnlyKeys } = require('../utils/profileVisibility');
const { sanitizeMustHaves } = require('../utils/preferenceFit');
const { invalidateDailyMatches } = require('../utils/dailyMatchesCache');
const { applyFieldVisibility, sanitizeFieldVisibility } = require('../constants/fieldVisibility');
const { revealablePhone, contactOf, contactShareFor } = require('../utils/contactDetails');
const { sameGotra } = require('../utils/gotra');
const { levelFor, canSee } = require('../constants/fieldVisibility');
const { getActiveSubscription } = require('../utils/entitlements');
const { visibleSocialLinks, normalizeSocialLinks } = require('../utils/socialLinks');
const { Op, QueryTypes } = require('sequelize');
const { randomUUID } = require('crypto');
const sequelize = require('../config/database');
const { PAID_PLANS } = require('../constants/plans');
const { calculateCompatibility, getCompatibilityBreakdown: calcBreakdown, getKundliMatch, buildKundliSummary, isManglikCompatible, getRashiCompatibility } = require('../utils/compatibility');
const { getNumerologyMatch } = require('../utils/numerology');
const { generateKundliPDF } = require('../utils/kundli');
const { generateBiodataPDF, TEMPLATES: BIODATA_TEMPLATES } = require('../utils/biodata');
const { toProfileCode } = require('../utils/profileCode');
const { sanitizeSavedSearchList } = require('../utils/savedSearches');
const { notify } = require('../utils/notifyUser');
const { withSignedMedia, signMediaUrl, TTL: MEDIA_TTL } = require('../utils/privateMedia');

// Private intro media leaves the server as short-lived URLs only.
const INTRO_MEDIA = { voiceIntroUrl: MEDIA_TTL.playback, videoIntroUrl: MEDIA_TTL.playback };
const { trackEvent } = require('../utils/trackEvent');

// Completion milestones and their messages
const COMPLETION_MILESTONES = [
  { pct: 50, title: 'Profile 50% complete!', body: 'Add your education & profession to boost your matches.' },
  { pct: 70, title: 'Profile 70% complete!', body: 'Add your horoscope details and a few photos to reach 80%+ and appear in more searches.' },
  { pct: 80, title: 'Profile 80% complete!', body: 'Almost there — add your bio and interest tags to complete your profile.' },
  { pct: 100, title: 'Profile 100% complete! 🎉', body: 'Congratulations! You now appear at the top of search results.' },
];

const checkMilestone = async (userId, prevPct, newPct) => {
  for (const m of COMPLETION_MILESTONES) {
    if (prevPct < m.pct && newPct >= m.pct) {
      await notify(userId, 'system', m.title, m.body);
      break; // only one milestone per save
    }
  }
};
const { deleteFromCloudinary } = require('../middlewares/upload');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');
const { PROFILE_EDITABLE_FIELDS, NULLABLE_NONSTRING_FIELDS } = require('../constants/profileFields');
const { findContactInText, CONTACT_IN_TEXT_MESSAGES } = require('../utils/contactInText');

// Free text other members read on the profile. (socialMediaLinks is left out on
// purpose: it is the place a member chooses to share links.)
const CONTACT_SCREENED_FIELDS = [
  'bio', 'profilePrompts', 'firstName', 'lastName',
  'fatherOccupation', 'motherOccupation', 'profession', 'institution', 'familyLocation',
];

// Every string inside a value that may be a JSON string, an array or an object.
const stringsIn = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { return stringsIn(JSON.parse(trimmed)); } catch { /* plain text */ }
    }
    return [value];
  }
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
};

// Maximum number of gallery photos allowed
const MAX_GALLERY_PHOTOS = config.upload.maxGalleryPhotos;

// Calculate profile completion percentage based on IMPORTANT fields only
const calculateCompletion = (profile) => {
  if (!profile) return 0;

  let completed = 0;
  let total = 0;

  // ===== REQUIRED FIELDS (35%) - Must have for basic profile =====
  total += 35;
  if (profile.firstName && profile.firstName.trim()) completed += 7;
  if (profile.lastName && profile.lastName.trim()) completed += 7;
  if (profile.gender) completed += 7;
  if (profile.dateOfBirth) completed += 7;
  if (profile.city && profile.city.trim()) completed += 7;

  // ===== IMPORTANT FIELDS (50%) - Highly recommended =====
  total += 50;

  // Physical Info (8%)
  if (profile.height) completed += 4;
  if (profile.weight) completed += 4;

  // Education & Career (12%)
  if (profile.education && profile.education.trim()) completed += 6;
  if (profile.profession && profile.profession.trim()) completed += 6;

  // Profile Photo (10%) - Very important for matches
  if (profile.profilePhoto) completed += 10;

  // Bio (8%) - Important for personality
  if (profile.bio && profile.bio.trim().length >= 20) completed += 8;

  // Lifestyle Preferences (4%) - At least one lifestyle field
  let lifestyleCount = 0;
  if (profile.diet) lifestyleCount++;
  if (profile.smoking) lifestyleCount++;
  if (profile.drinking) lifestyleCount++;
  if (lifestyleCount > 0) completed += 4;

  // Religion & Marital Status (5%) - Important for Indian matrimony
  if (profile.religion && profile.religion.trim()) completed += 3;
  if (profile.maritalStatus) completed += 2;

  // Mother Tongue (3%)
  if (profile.motherTongue && profile.motherTongue.trim()) completed += 3;

  // ===== OPTIONAL ENHANCEMENTS (15%) - Nice to have =====
  total += 15;

  // Additional photos
  if (profile.photos && profile.photos.length > 0) completed += 3;

  // Community & birth details (4%) — these replaced personalityValues /
  // familyPreferences, which had NO editor input on web and so capped every user
  // below 100%. Both of these ARE collectible in the profile editor now.
  if (profile.caste && profile.caste.trim()) completed += 2;
  if ((profile.placeOfBirth && profile.placeOfBirth.trim()) ||
      (profile.birthTime && profile.birthTime.trim())) completed += 2;

  // Interest tags
  if (profile.interestTags && profile.interestTags.length > 0) completed += 2;

  // Horoscope / Kundli (3%) - any horoscope field filled
  let horoscopeCount = 0;
  if (profile.manglikStatus) horoscopeCount++;
  if (profile.rashi && profile.rashi.trim()) horoscopeCount++;
  if (profile.nakshatra && profile.nakshatra.trim()) horoscopeCount++;
  if (profile.zodiacSign && profile.zodiacSign.trim()) horoscopeCount++;
  if (horoscopeCount > 0) completed += 3;

  // Family details (3%) - family type or status filled
  let familyCount = 0;
  if (profile.familyType) familyCount++;
  if (profile.familyStatus) familyCount++;
  if (profile.fatherOccupation && profile.fatherOccupation.trim()) familyCount++;
  if (profile.motherOccupation && profile.motherOccupation.trim()) familyCount++;
  if (familyCount > 0) completed += 3;

  // Calculate percentage
  const percentage = Math.round((completed / total) * 100);

  // Cap at 100% and ensure minimum is 0%
  return Math.max(0, Math.min(100, percentage));
};

// @route   GET /api/profile/me
// @desc    Get current user's profile
// @access  Private
exports.getMyProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({
    where: { userId: req.user.id },
    include: [{ model: User, attributes: ['email', 'phone', 'status'] }]
  });

  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  // Always recalculate completion percentage to ensure accuracy
  const profileData = profile.toJSON();
  const calculatedCompletion = calculateCompletion(profileData);

  // Update if different from stored value
  if (profile.completionPercentage !== calculatedCompletion) {
    profile.completionPercentage = calculatedCompletion;
    await profile.save();
  }

  const payload = withSignedMedia(profile.get ? profile.get({ plain: true }) : profile.toJSON(), INTRO_MEDIA);

  // Own verification state, derived the same way every other surface derives it
  // (an approved Verification row — there is no column). Without it the member's
  // own dashboard had no way to know whether the badge had been earned, so it
  // could not prompt for the one thing that most improves a profile's standing.
  const approvedVerification = await Verification.findOne({
    where: { userId: req.user.id, status: 'approved' },
    attributes: ['id'],
  });
  payload.isVerified = !!approvedVerification;

  res.json({
    success: true,
    profile: payload
  });
});

// @route   PUT /api/profile/me
// @desc    Update user's profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'development') {
    const ct = req.headers['content-type'] || '';
    const fileCount = req.files ? Object.keys(req.files).reduce((n, k) => n + (req.files[k]?.length || 0), 0) : 0;
    console.log('[profile] PUT /me Content-Type:', ct.slice(0, 50), '| files:', fileCount);
  }
  const profile = await Profile.findOne({ where: { userId: req.user.id } });

  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  // Allowlisted profile fields — NEVER spread req.body directly to prevent mass-assignment.
  // Single source of truth (backend/constants/profileFields.js), shared with the validator
  // stripper so the two can never drift again (the drift silently dropped religion/caste/
  // family/horoscope/numberOfSiblings). onboardingComplete is intentionally excluded here —
  // it is server-controlled (set at signup), never client-settable via PUT /me.
  const PROFILE_UPDATABLE_FIELDS = PROFILE_EDITABLE_FIELDS;

  // Contact details in text every member can read would skip the paid unlock
  // and the member's own contact-sharing setting (and are how scams start).
  for (const field of CONTACT_SCREENED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, field)) continue;
    const kind = findContactInText(stringsIn(req.body[field]).join('\n'));
    if (kind) {
      const err = createError.badRequest(CONTACT_IN_TEXT_MESSAGES[kind], { field });
      err.code = 'CONTACT_IN_TEXT';
      throw err;
    }
  }

  // Use transaction for data consistency
  let heldPhotoCount = 0;
  await sequelize.transaction(async (t) => {
    // Build updateData from ONLY allowlisted fields — prevents mass-assignment
    const bodyProfilePhoto = req.body?.profilePhoto;
    const updateData = {};
    
    // Fields that must be arrays in the database (excluding photos which is handled separately)
    const arrayFields = ['preferredCity', 'interestTags', 'languages'];
    // Boolean columns — coerce multipart 'true'/'false' strings to real booleans.
    const booleanFields = ['isNri', 'showPhone', 'showEmail', 'incognitoMode', 'photoBlurUntilMatch', 'excludeSameGotra'];
    // Fields that must be JSON in the database
    const jsonFields = ['personalityValues', 'familyPreferences', 'lifestylePreferences', 'profilePrompts', 'quizAnswers', 'socialMediaLinks'];
    
    for (const field of PROFILE_UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        let value = req.body[field];
        
        if (booleanFields.includes(field)) {
          // Multipart sends booleans as the strings 'true'/'false'. A raw
          // assignment would store 'false' as truthy (non-empty string).
          updateData[field] = value === true || value === 'true' || value === '1';
        } else if (arrayFields.includes(field)) {
          // If multer parsed a single appended element, it's a string. Make it an array.
          updateData[field] = typeof value === 'string' ? (value ? [value] : []) : value;
        } else if (field === 'mustHavePreferences') {
          updateData[field] = sanitizeMustHaves(value);
        } else if (field === 'fieldVisibility') {
          // Merge onto the stored value so changing one group keeps the other.
          updateData[field] = { ...(profile.fieldVisibility || {}), ...sanitizeFieldVisibility(value) };
        } else if (jsonFields.includes(field)) {
          // If the frontend stringified the object for FormData, parse it back
          if (typeof value === 'string') {
            try {
              updateData[field] = JSON.parse(value);
            } catch (e) {
              updateData[field] = value;
            }
          } else {
            updateData[field] = value;
          }
        } else {
          // Strip HTML tags from free-text fields to prevent stored XSS
          const freeTextFields = ['bio', 'education', 'degree', 'profession', 'city', 'state',
            'residenceCountry', 'residenceStatus', 'familyLocation',
            'religion', 'caste', 'subCaste', 'gotra', 'motherTongue', 'placeOfBirth',
            'birthTime', 'rashi', 'nakshatra', 'zodiacSign', 'fatherOccupation', 'motherOccupation',
            'preferredEducation', 'preferredProfession', 'firstName', 'lastName', 'personalityType',
            'nationality', 'institution', 'industry'];
          if (freeTextFields.includes(field) && typeof value === 'string') {
            value = value.replace(/<[^>]*>/g, '').trim();
          }
          updateData[field] = value;
        }
      }
    }

    // Coerce empty-string enum/int fields to null. A multipart form sends cleared
    // dropdowns as '', which Postgres rejects for ENUM/INTEGER columns (raw 500).
    // '' means "clear this field" → null. (String free-text fields keep '' as valid.)
    NULLABLE_NONSTRING_FIELDS.forEach((key) => {
      if (updateData[key] === '') updateData[key] = null;
    });

    // Don't overwrite critical fields with empty — keeps suggestions/discovery working (e.g. gender)
    const criticalFields = ['gender', 'firstName', 'lastName', 'dateOfBirth'];
    criticalFields.forEach((key) => {
      const v = updateData[key];
      if (v === '' || v === null || v === undefined) delete updateData[key];
    });

    // Age rule (21 men / 18 women / 21 other) and the post-onboarding lock on
    // date of birth + gender. Runs on the sanitised update so an unchanged
    // resubmitted value is dropped rather than re-validated.
    applyIdentityRules(profile, updateData);

    // Normalize social connections to the canonical { key: {url, visibility} }
    // shape, dropping unknown platforms and unsafe (non-http) URLs. null clears
    // the field. Display-only links — no ownership proof, no credibility weight.
    if (Object.prototype.hasOwnProperty.call(updateData, 'socialMediaLinks')) {
      updateData.socialMediaLinks = normalizeSocialLinks(updateData.socialMediaLinks);
    }

    // lifestylePreferences is a client-editable JSONB blob that ALSO happens to
    // hold savedSearches, which the weekly-digest job feeds into a Sequelize
    // `where`. Writing it through this generic path bypassed the saved-search
    // endpoint's whitelist and its 5-entry cap, so re-apply both here. Only the
    // savedSearches key is touched; the rest of the blob is preserved.
    if (Object.prototype.hasOwnProperty.call(updateData, 'lifestylePreferences')) {
      const lp = updateData.lifestylePreferences;
      if (lp && typeof lp === 'object' && !Array.isArray(lp)
          && Object.prototype.hasOwnProperty.call(lp, 'savedSearches')) {
        updateData.lifestylePreferences = {
          ...lp,
          savedSearches: sanitizeSavedSearchList(lp.savedSearches),
        };
      }
    }

    // Normalize file path: Cloudinary returns full URL; local storage returns path — store URL path for local
    const getStoredPath = (file) => {
      if (!file || !file.path) return null;
      if (String(file.path).includes('cloudinary')) return file.path;
      return `/uploads/${file.filename || file.path.replace(/^.*[/\\\\]/, '')}`;
    };

    let finalPhotos = [...(profile.photos || [])];
    let finalProfilePhoto = profile.profilePhoto;

    // Handle photo uploads
    if (req.files) {
      if (req.files.photos?.length) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[profile] Received', req.files.photos.length, 'photo(s) for gallery');
        }
      }
      // Handle gallery photos
      if (req.files.photos) {
        const newPhotoPaths = req.files.photos.map(getStoredPath).filter(Boolean);
        finalPhotos = [...finalPhotos, ...newPhotoPaths];
        if (finalPhotos.length > MAX_GALLERY_PHOTOS) {
          const toDelete = finalPhotos.slice(MAX_GALLERY_PHOTOS);
          for (const photoUrl of toDelete) {
            try {
              if (photoUrl && photoUrl.includes('cloudinary')) await deleteFromCloudinary(photoUrl);
            } catch (err) {
              log.error('Error deleting excess photo from Cloudinary', { error: err.message });
            }
          }
          finalPhotos = finalPhotos.slice(0, MAX_GALLERY_PHOTOS);
        }
        if (!finalProfilePhoto && finalPhotos.length > 0) {
          finalProfilePhoto = finalPhotos[0];
        }
      }

      // Handle profile photo (single file): add to gallery and set as main
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        const file = req.files.profilePhoto[0];
        const pathUrl = getStoredPath(file);
        if (pathUrl) {
          finalProfilePhoto = pathUrl;
          if (!finalPhotos.includes(pathUrl)) {
            finalPhotos = [pathUrl, ...finalPhotos].slice(0, MAX_GALLERY_PHOTOS);
          }
        }
      }
    }

    // Allow setting profile photo from existing gallery (e.g. "Set as profile photo")
    if (bodyProfilePhoto && typeof bodyProfilePhoto === 'string' && bodyProfilePhoto.trim()) {
      const allowedPhotos = finalPhotos.length ? finalPhotos : (profile.photos || []);
      if (allowedPhotos.includes(bodyProfilePhoto.trim())) {
        finalProfilePhoto = bodyProfilePhoto.trim();
      }
    }

    // Screen the photos uploaded in THIS request. Flagged ones are held off the
    // profile (never visible to anyone) and queued for staff; the member is told.
    const uploadedNow = [
      ...(req.files?.photos || []).map(getStoredPath),
      ...(req.files?.profilePhoto || []).map(getStoredPath),
    ].filter(Boolean);
    const { held } = await holdFlaggedPhotos({
      userId: req.user.id,
      newUrls: [...new Set(uploadedNow)],
      profilePhoto: finalProfilePhoto,
      MediaReview,
      transaction: t,
    });
    if (held.length) {
      heldPhotoCount = held.length;
      finalPhotos = finalPhotos.filter((u) => !held.includes(u));
      if (held.includes(finalProfilePhoto)) finalProfilePhoto = finalPhotos[0] || null;
    }

    updateData.photos = finalPhotos;
    updateData.profilePhoto = finalProfilePhoto || null;

    // Server-controlled onboarding completion (one-way false→true). onboardingComplete
    // is never client-settable via PUT /me (mass-assignment guard above), but mobile
    // signup is email+password only, so the account starts un-onboarded and fills the
    // identity triple across the 14-step flow. Mirror the signup rule — once the
    // resulting profile has firstName + gender + dateOfBirth, mark it onboarded so a
    // returning user isn't sent back through onboarding. Never flips true→false.
    if (!profile.onboardingComplete) {
      const nextFirstName = Object.prototype.hasOwnProperty.call(updateData, 'firstName') ? updateData.firstName : profile.firstName;
      const nextGender = Object.prototype.hasOwnProperty.call(updateData, 'gender') ? updateData.gender : profile.gender;
      const nextDob = Object.prototype.hasOwnProperty.call(updateData, 'dateOfBirth') ? updateData.dateOfBirth : profile.dateOfBirth;
      if (nextFirstName && nextGender && nextDob) {
        updateData.onboardingComplete = true;
      }
    }

    // Update profile with new data
    await profile.update(updateData, { transaction: t });
  });

  // Reload and recalculate completion
  await profile.reload();
  const profileData = profile.toJSON();
  const prevCompletion = profileData.completionPercentage || 0;
  const completion = calculateCompletion(profileData);

  profile.completionPercentage = completion;
  await profile.save();

  // Fire milestone notification if a threshold was crossed
  checkMilestone(req.user.id, prevCompletion, completion).catch((err) => {
    log.error('Milestone notification failed', { error: err.message });
  });

  // Funnel stage 4 — the 60% crossing. prevCompletion is the value stored BEFORE
  // this save, so the crossing itself is detectable (a profile that was already
  // ≥60% doesn't re-emit). The partial unique index makes it once-per-user
  // regardless. Fire-and-forget: never awaited.
  if (prevCompletion < 60 && completion >= 60) {
    trackEvent(req.user.id, 'profile_60pct');
  }

  // A changed main photo or name withdraws the photo-verified badge until re-reviewed.
  await recheckVerification(req.user.id);

  // Today's matches were ranked against the old profile / must-haves.
  await invalidateDailyMatches(req.user.id);

  // Reload once more so response has latest DB state; send plain object so client gets photos array
  await profile.reload();
  const payload = withSignedMedia(profile.get ? profile.get({ plain: true }) : profile.toJSON(), INTRO_MEDIA);

  if (process.env.NODE_ENV === 'development' && payload.photos?.length) {
    console.log('[profile] Responding with photos count:', payload.photos.length);
  }

  if (heldPhotoCount > 0) {
    notify(
      req.user.id,
      'system',
      'A photo is being reviewed',
      heldPhotoCount === 1
        ? 'One of your new photos is being checked by our team before it appears on your profile. We will let you know.'
        : `${heldPhotoCount} of your new photos are being checked by our team before they appear on your profile. We will let you know.`
    ).catch((err) => log.error('Held-photo notification failed', { error: err.message }));
  }

  res.json({
    success: true,
    profile: payload,
    // Photos from this upload that are waiting for a reviewer (0 when none).
    photosUnderReview: heldPhotoCount,
    message: heldPhotoCount > 0
      ? 'Profile updated. Some photos are under review before they go live.'
      : 'Profile updated successfully'
  });
});

// @route   DELETE /api/profile/me/photo
// @desc    Delete a photo from gallery
// @access  Private
exports.deletePhoto = asyncHandler(async (req, res) => {
  const { photoUrl } = req.body;

  const profile = await Profile.findOne({ where: { userId: req.user.id } });

  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  const currentPhotos = profile.photos || [];
  const photoIndex = currentPhotos.indexOf(photoUrl);

  if (photoIndex === -1) {
    throw createError.notFound('Photo not found in gallery');
  }

  // Delete from Cloudinary (only Cloudinary URLs)
  try {
    if (photoUrl && photoUrl.includes('cloudinary')) {
      await deleteFromCloudinary(photoUrl);
    }
  } catch (err) {
    log.error('Error deleting photo from Cloudinary', { error: err.message });
  }

  // New array so Sequelize detects change and persists
  const updatedPhotos = currentPhotos.filter((url) => url !== photoUrl);
  profile.photos = updatedPhotos;
  if (profile.profilePhoto === photoUrl) {
    profile.profilePhoto = updatedPhotos.length > 0 ? updatedPhotos[0] : null;
  }
  await profile.save();

  // Recalculate completion (use current in-memory profile, no reload yet)
  const profileData = profile.get ? profile.get({ plain: true }) : profile.toJSON();
  const completion = calculateCompletion(profileData);
  profile.completionPercentage = completion;
  await profile.save();

  await recheckVerification(req.user.id);

  res.json({
    success: true,
    message: 'Photo deleted successfully',
    photos: profile.photos,
    profilePhoto: profile.profilePhoto,
  });
});

// @route   DELETE /api/profile/me/profile-photo
// @desc    Delete profile photo
// @access  Private
exports.deleteProfilePhoto = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ where: { userId: req.user.id } });

  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  if (!profile.profilePhoto) {
    throw createError.notFound('No profile photo to delete');
  }

  const urlToRemove = profile.profilePhoto;
  // Delete from Cloudinary (only Cloudinary URLs)
  try {
    if (urlToRemove.includes('cloudinary')) {
      await deleteFromCloudinary(urlToRemove);
    }
  } catch (err) {
    log.error('Error deleting profile photo from Cloudinary', { error: err.message });
  }

  // Remove from profile and from photos array
  profile.profilePhoto = null;
  const photos = profile.photos || [];
  const idx = photos.indexOf(urlToRemove);
  if (idx !== -1) {
    photos.splice(idx, 1);
    profile.photos = photos;
  }
  await profile.save();

  // Recalculate completion
  await profile.reload();
  const profileData = profile.toJSON();
  const completion = calculateCompletion(profileData);
  profile.completionPercentage = completion;
  await profile.save();

  await recheckVerification(req.user.id);

  res.json({
    success: true,
    message: 'Profile photo deleted successfully'
  });
});

/**
 * Shared visibility gate for any endpoint that reads ANOTHER user's profile.
 *
 * getProfile grew four gates over time (active account, active profile,
 * matches_only, block) but its siblings — compatibility, horoscope-match and
 * the Kundli PDF — fetched the target with a bare Profile.findOne and so
 * skipped every one of them. The PDF renders full name, exact DOB and place of
 * birth, which made it an enumeration oracle over the whole user table
 * including deleted, suspended, matches_only and blocking members.
 *
 * Returns the gated profile plus the mutual-match flag callers need.
 * Throws 404 when the target is absent/inactive, 403 when a gate rejects.
 */
const assertProfileVisible = async (
  viewerId,
  targetUserId,
  { viewerRole, enforceVisibilityPreference = true } = {}
) => {
  const profile = await Profile.findOne({
    where: { userId: targetUserId, isActive: true },
    include: [
      {
        model: User,
        attributes: ['id', 'status'],
        where: { status: 'active' },
        required: true,
      },
    ],
  });

  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  // Viewing yourself bypasses the visibility gates — getProfile does this by
  // short-circuiting to getMyProfile, and without the equivalent here a member
  // whose own profile is set to matches_only got a 403 on their OWN
  // compatibility/horoscope.
  if (viewerId === targetUserId) {
    return { profile, isMutual: false, isSelf: true };
  }

  // A profile whose age cannot be checked is not shown to anyone else.
  if (!hasVerifiableAge(profile)) {
    throw createError.notFound('Profile not found');
  }

  // Blocks are bidirectional and must not reveal which direction fired.
  const blockExists = await Block.findOne({
    where: {
      [Op.or]: [
        { blockerId: viewerId, blockedUserId: targetUserId },
        { blockerId: targetUserId, blockedUserId: viewerId },
      ],
    },
    attributes: ['id'],
  });
  if (blockExists) {
    throw createError.forbidden('Cannot perform this action');
  }

  const existingMatch = await Match.findOne({
    where: { userId: viewerId, matchedUserId: targetUserId },
    attributes: ['isMutual'],
  });
  const isMutual = existingMatch?.isMutual || false;

  // enforceVisibilityPreference=false is used only for contact details the
  // viewer has ALREADY paid to unlock: flipping a profile to matches_only is a
  // discovery preference and must not retroactively confiscate something that
  // was bought. Account status and blocks are still enforced above — those are
  // withdrawal of consent, not a display setting.
  const isAdminViewer = viewerRole === 'admin' || viewerRole === 'super_admin';
  if (enforceVisibilityPreference
      && profile.profileVisibility === 'matches_only' && !isMutual && !isAdminViewer) {
    throw createError.forbidden(
      'This profile is only visible to their matches.',
      'PROFILE_MATCHES_ONLY'
    );
  }

  return { profile, isMutual };
};

exports.assertProfileVisible = assertProfileVisible;

// @route   GET /api/profile/:userId
// @desc    Get user profile by ID (with privacy checks)
// @access  Private
exports.getProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const viewerId = req.user.id;

  if (userId === viewerId) {
    return exports.getMyProfile(req, res);
  }

  // Single authoritative gate. This used to be three inline checks (active-user
  // inner join, bidirectional block, matches_only) that duplicated
  // assertProfileVisible line for line — and divergence between the two copies
  // is exactly how the previous IDOR was introduced. One implementation now.
  //
  // The old query also carried `include: [{ model: Subscription, ... }]` nested
  // under User. Nothing read it — the target's plan is re-fetched below as
  // `targetSubscription` — but profile.toJSON() serialised it straight into the
  // response, so every viewer received the target's full subscription row
  // including razorpayOrderId, razorpayPaymentId, razorpaySignature, amount and
  // their remaining contact-unlock quota. Removed.
  const { profile } = await assertProfileVisible(viewerId, userId, {
    viewerRole: req.user.role,
  });

  // Check subscription for contact visibility
  // Live paid plan only: the query carries the endDate predicate, so a row that
  // still says 'active' after its end date (the hourly sweep is cleanup, not
  // correctness) no longer grants intro media or contact display here.
  const viewerSubscription = await getActiveSubscription(viewerId);

  const hasPremiumAccess = Boolean(viewerSubscription);

  // Check if contact was already unlocked
  const existingUnlock = await ContactUnlock.findOne({
    where: { userId: viewerId, targetUserId: userId }
  });
  const isContactUnlocked = !!existingUnlock;

  // Calculate compatibility (also tells us the viewer's incognito preference)
  const viewerProfile = await Profile.findOne({ where: { userId: viewerId } });

  // Record profile view — CTRL-1: incognito is the VIEWER's "browse privately"
  // choice, so when the viewer is incognito we simply don't record the visit
  // (no create-then-destroy round-trip, no race where the target briefly sees it).
  // Staff (admins, partners) looking at a profile is not a member's interest in
  // it, and must not surface in that member's "who viewed you".
  if (!viewerProfile?.incognitoMode && req.user.role === 'user') {
    // One row per (viewer, viewed) pair — a unique index. A repeat visit moves the
    // row's timestamp forward instead of being dropped, so "viewed at", the
    // recently-viewed order and this week's count all follow the latest visit.
    await sequelize.query(
      `INSERT INTO "ProfileViews" (id, "viewerId", "viewedUserId", "createdAt", "updatedAt")
       VALUES (:id, :viewerId, :viewedUserId, NOW(), NOW())
       ON CONFLICT ("viewerId", "viewedUserId")
       DO UPDATE SET "createdAt" = NOW(), "updatedAt" = NOW()`,
      { replacements: { id: randomUUID(), viewerId, viewedUserId: userId } }
    );
  }

  let compatibilityScore = null;
  if (viewerProfile) {
    compatibilityScore = calculateCompatibility(viewerProfile, profile);
  }

  // Check match status
  const existingMatch = await Match.findOne({
    where: { userId: viewerId, matchedUserId: userId }
  });
  const isLiked = existingMatch && existingMatch.action === 'like';
  const isShortlisted = existingMatch && existingMatch.action === 'shortlist';
  const isMutual = existingMatch?.isMutual || false;

  // (matches_only, block and account-status gates are enforced by
  // assertProfileVisible above.)

  // Prepare response with privacy checks
  const profileData = profile.toJSON();

  // Owner-only keys (private settings, quiz answers, the member's own saved
  // searches) are never useful to another viewer. A member viewing their own
  // profile through this route still gets everything.
  if (viewerId !== userId) {
    // Field-level visibility reads the owner's setting, so it runs first.
    applyFieldVisibility(profileData, { isMutual, isSelf: false });
    stripOwnerOnlyKeys(profileData);
  }

  // (Incognito handling moved up — the view is simply not recorded when the
  // viewer browses in incognito mode. See CTRL-1.)

  // Enforce photo blur: replace photo URLs with null for non-mutual viewers when photoBlurUntilMatch is set
  if (profile.photoBlurUntilMatch && !isMutual) {
    profileData.profilePhoto = null;
    profileData.photos = [];
  }

  // Voice and video intros are gated in the mobile UI (AudioIntroChip refuses to
  // play and shows a padlock for a free, non-mutual viewer) but the URL itself
  // was never redacted here -- so the Cloudinary media link shipped in the JSON
  // and could simply be fetched with curl. A gate that exists only in the client
  // is not a gate. Same rule the client applies: mutual match, or a paid plan.
  if (!isMutual && !hasPremiumAccess) {
    profileData.voiceIntroUrl = null;
    profileData.videoIntroUrl = null;
  }

  // Only fetch contact details from DB when the viewer has actually earned access.
  // This prevents any accidental leakage through JSON serialisation.
  // The owner's choice is read from the raw profile row: fieldVisibility is
  // already stripped from `profileData` above.
  const contactLevel = levelFor(profile.fieldVisibility, 'contact');
  const contactShared = canSee(contactLevel, { isMutual });

  if (hasPremiumAccess && isContactUnlocked && contactShared) {
    const targetUser = await User.findByPk(userId, { attributes: ['phone', 'email', 'phoneVerified', 'contactPhone'] });
    // Only a number the owner proved they control is ever revealed.
    const revealedPhone = revealablePhone(targetUser);
    if (profileData.User) {
      profileData.User.phone = revealedPhone ?? null;
      profileData.User.email = targetUser?.email ?? null;
    } else {
      profileData.contactPhone = revealedPhone ?? null;
      profileData.contactEmail = targetUser?.email ?? null;
    }
  } else {
    if (profileData.User) {
      delete profileData.User.phone;
      delete profileData.User.email;
    }
  }

  // Social connections are display-only links, independent of the contact
  // paywall. Show them per the OWNER's own per-link visibility choice
  // (everyone / matches_only / hidden) rather than gating them behind premium.
  profileData.socialMediaLinks = visibleSocialLinks(profileData.socialMediaLinks, {
    isOwner: false,
    isMutual,
  });

  // Verified badge: derived from an approved Verification. getProfile never
  // included the Verification association, so ProfileDetail's badge was always
  // false — attach it explicitly so a direct profile view matches search cards.
  const approvedVerification = await Verification.findOne({
    where: { userId, status: 'approved' },
    attributes: ['id'],
  });
  profileData.isVerified = !!approvedVerification;

  // Check if target user has premium (for badge display)
  const targetSubscription = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      planType: { [Op.in]: PAID_PLANS },
      endDate: { [Op.gt]: new Date() }
    }
  });

  res.json({
    success: true,
    profile: {
      ...profileData,
      isPremium: !!targetSubscription,
      premiumPlan: targetSubscription?.planType || null
    },
    compatibilityScore,
    hasPremiumAccess,
    isContactUnlocked,
    contactShare: { level: contactLevel, allowed: contactShared },
    // Both members recorded a gotra and it is the same one. The profile page
    // shows a quiet note; nothing is hidden by this.
    sameGotra: sameGotra(viewerProfile && viewerProfile.gotra, profile.gotra),
    contactUnlocksRemaining: hasPremiumAccess
      ? (viewerSubscription.contactUnlocksAllowed === null
        ? -1
        : Math.max(0, (viewerSubscription.contactUnlocksAllowed || 0) - (viewerSubscription.contactUnlocksUsed || 0)))
      : 0,
    isLiked,
    isShortlisted,
    isMutual
  });
});

// @route   GET /api/profile/me/stats
// @desc    Get profile engagement stats
// @access  Private
exports.getProfileStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Same scope as the lists these numbers sit beside: no one in a block
  // relationship with the member, and no one whose account is no longer active.
  const blockedIds = [...(await blockedIdsFor(userId))];
  const activeUser = (as) => ({ model: User, as, attributes: [], required: true, where: { status: 'active' } });
  const notBlocked = (col) => (blockedIds.length ? { [col]: { [Op.notIn]: blockedIds } } : {});

  const [viewsThisWeek, totalViews, likesReceived, likesByCity] = await Promise.all([
    ProfileView.count({
      where: { viewedUserId: userId, createdAt: { [Op.gte]: weekAgo }, ...notBlocked('viewerId') },
      include: [activeUser('Viewer')],
    }),
    ProfileView.count({
      where: { viewedUserId: userId, ...notBlocked('viewerId') },
      include: [activeUser('Viewer')],
    }),
    Match.count({
      where: { matchedUserId: userId, action: 'like', ...notBlocked('userId') },
      include: [activeUser('User')],
    }),
    Match.findAll({
      where: { matchedUserId: userId, action: 'like', ...notBlocked('userId') },
      include: [{
        model: User, as: 'User', attributes: ['id'], required: true, where: { status: 'active' },
        include: [{ model: Profile, attributes: ['city'] }]
      }],
      attributes: ['id']
    })
  ]);

  const cityCounts = {};
  likesByCity.forEach(match => {
    const city = match.User?.Profile?.city || 'Unknown';
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  res.json({
    success: true,
    stats: { viewsThisWeek, totalViews, likesReceived, likesByCity: cityCounts }
  });
});

// @route   POST /api/profile/:userId/unlock-contact
// @desc    Unlock contact details for a specific profile
// @access  Private/Premium
exports.unlockContact = asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.params;
  const userId = req.user.id;

  if (userId === targetUserId) {
    throw createError.badRequest('Cannot unlock your own contact');
  }

  // Check if already unlocked
  const existing = await ContactUnlock.findOne({ where: { userId, targetUserId } });

  // The owner's own choice about who gets their contact details. It is checked
  // before anything else and it applies to an unlock that was already paid for
  // too: a setting that left every earlier buyer with the number would not be
  // hiding it. Nothing is spent when it blocks.
  const ownerProfile = await Profile.findOne({ where: { userId: targetUserId }, attributes: ['fieldVisibility'] });
  const share = await contactShareFor(ownerProfile?.fieldVisibility, targetUserId, userId);
  if (!share.allowed) {
    throw createError.forbidden(
      share.reason === 'CONTACT_NOT_SHARED'
        ? 'This member has chosen not to share their contact details. No unlock was used.'
        : 'This member shares contact details only with their matches. Send an interest first. No unlock was used.',
      share.reason
    );
  }

  // Validate the target BEFORE any quota is consumed. This handler used to go
  // straight to the INSERT, so unlocking a deleted/suspended/nonexistent user
  // burned one of the plan's paid unlocks permanently and returned
  // {phone: null, email: null}. It also ignored the block list and the target's
  // matches_only setting, letting a premium member buy contact details for a
  // profile they are not even allowed to view.
  //
  // An unlock that was ALREADY paid for keeps resolving even if the target
  // later switches to matches_only — that setting governs discovery, not a
  // refund of something purchased. Account deletion/suspension and an explicit
  // block still stop it, because those are a withdrawal of consent.
  await assertProfileVisible(userId, targetUserId, {
    viewerRole: req.user.role,
    enforceVisibilityPreference: !existing,
  });
  if (existing) {
    const tp = await Profile.findOne({
      where: { userId: targetUserId },
      include: [{ model: User, attributes: ['email', 'phone', 'phoneVerified', 'contactPhone'] }]
    });
    return res.json({
      success: true,
      alreadyUnlocked: true,
      contact: contactOf(tp?.User)
    });
  }

  // Nothing to call means nothing to buy: refuse before a paid unlock is spent.
  const targetContact = await User.findByPk(targetUserId, { attributes: ['phone', 'phoneVerified', 'contactPhone'] });
  if (!revealablePhone(targetContact)) {
    throw createError.conflict(
      'This member has not verified a contact number yet, so no unlock was used. Send them an interest and check back soon.'
    );
  }

  let result;
  try {
    result = await sequelize.transaction(async (t) => {
      // ON CONFLICT DO NOTHING rather than a plain INSERT: a duplicate raises a
      // unique violation that aborts the whole Postgres transaction, so every
      // later statement in it failed with "current transaction is aborted" and
      // the member got a 500 for merely double-tapping Unlock.
      //
      // Raw INSERT ... RETURNING, not bulkCreate({ignoreDuplicates}): Sequelize
      // hands back the *built* instances (UUID generated client-side) whether or
      // not a row was actually written, so it cannot tell us who won the race —
      // eight concurrent taps on one profile were billed as six unlocks.
      const insertedRows = await sequelize.query(
        `INSERT INTO "ContactUnlocks" ("id", "userId", "targetUserId", "createdAt", "updatedAt")
         VALUES (:id, :userId, :targetUserId, NOW(), NOW())
         ON CONFLICT ("userId", "targetUserId") DO NOTHING
         RETURNING "id"`,
        {
          replacements: { id: randomUUID(), userId, targetUserId },
          type: QueryTypes.SELECT,
          transaction: t,
        }
      );
      const wonTheRace = Array.isArray(insertedRows) && insertedRows.length > 0;
      if (!wonTheRace) {
        // Another request created it; charge nothing and report it as unlocked.
        const tpDup = await Profile.findOne({
          where: { userId: targetUserId },
          include: [{ model: User, attributes: ['email', 'phone', 'phoneVerified', 'contactPhone'] }],
          transaction: t
        });
        return {
          duplicate: true,
          contact: contactOf(tpDup?.User),
        };
      }

      const subscription = req.subscription;
      let remaining = -1;

      if (subscription.contactUnlocksAllowed === null) {
        // Unlimited tier. checkContactUnlockLimit already counted the rolling
        // 24h window, but that count ran OUTSIDE any transaction and before the
        // insert, so N concurrent requests all read the same under-cap figure
        // and all proceeded — the anti-harvest ceiling was bypassable simply by
        // firing the unlocks in parallel (SEC R2: RACE-1).
        //
        // Re-check inside the transaction, after taking a row lock on this
        // user's own subscription. The lock is held to commit, so concurrent
        // unlocks by the same member serialise here and each one counts the
        // rows the previous one committed. The row for THIS request is already
        // inserted above, hence `>` rather than `>=`.
        const cap = config.limits?.unlimitedDailyUnlockCap ?? 25;
        if (cap > 0) {
          await Subscription.findByPk(subscription.id, {
            lock: t.LOCK.UPDATE,
            transaction: t,
          });
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const usedToday = await ContactUnlock.count({
            where: { userId, createdAt: { [Op.gte]: since } },
            transaction: t,
          });
          if (usedToday > cap) {
            throw createError.forbidden(
              `Daily limit of ${cap} contact unlocks reached. It resets on a rolling 24-hour basis.`,
              'DAILY_UNLOCK_LIMIT_REACHED'
            );
          }
        }
      }

      if (subscription.contactUnlocksAllowed !== null) {
        // Consume the quota with a single conditional UPDATE. Read-modify-write on
        // the in-memory instance let concurrent unlocks (double-taps, or several
        // tabs) all start from the same stale count and overwrite each other:
        // 11 unlock rows had been created against a counter that read 3, so the
        // plan's cap could be exceeded by any user issuing parallel requests.
        const [affected] = await Subscription.update(
          { contactUnlocksUsed: sequelize.literal('"contactUnlocksUsed" + 1') },
          {
            where: {
              id: subscription.id,
              [Op.and]: [
                sequelize.where(
                  sequelize.col('contactUnlocksUsed'),
                  Op.lt,
                  sequelize.col('contactUnlocksAllowed')
                ),
              ],
            },
            transaction: t,
          }
        );

        if (affected === 0) {
          // Someone else consumed the last unlock between the middleware's check
          // and this write — roll the ContactUnlock back with the transaction.
          throw createError.forbidden(
            `You have used all ${subscription.contactUnlocksAllowed} contact unlocks for your plan. Upgrade to unlock more.`
          );
        }

        const fresh = await Subscription.findByPk(subscription.id, {
          attributes: ['contactUnlocksUsed', 'contactUnlocksAllowed'],
          transaction: t,
        });
        remaining = Math.max(0, fresh.contactUnlocksAllowed - fresh.contactUnlocksUsed);
      }

      const tp = await Profile.findOne({
        where: { userId: targetUserId },
        include: [{ model: User, attributes: ['email', 'phone', 'phoneVerified', 'contactPhone'] }],
        transaction: t
      });

      return {
        contact: contactOf(tp?.User),
        remaining
      };
    });
  } catch (err) {
    // Belt and braces: if a unique violation still escapes (another index, a
    // dialect that doesn't support ON CONFLICT), report the unlock rather than
    // a 500 — the contact is unlocked either way.
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const tp = await Profile.findOne({
        where: { userId: targetUserId },
        include: [{ model: User, attributes: ['email', 'phone', 'phoneVerified', 'contactPhone'] }]
      });
      return res.json({
        success: true,
        alreadyUnlocked: true,
        contact: contactOf(tp?.User)
      });
    }
    throw err;
  }

  if (result.duplicate) {
    return res.json({
      success: true,
      alreadyUnlocked: true,
      contact: result.contact
    });
  }

  res.json({
    success: true,
    alreadyUnlocked: false,
    contact: result.contact,
    contactUnlocksRemaining: result.remaining
  });
});

// @route   GET /api/profile/me/viewers
// @desc    Get users who viewed the current user's profile (premium only)
// @access  Private/Premium
exports.getProfileViewers = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;

  // A member in a block relationship with the viewer is not shown as a viewer.
  const blockedIds = [...(await blockedIdsFor(userId))];

  const mutualRows = await Match.findAll({ where: { userId, isMutual: true }, attributes: ['matchedUserId'] });
  const mutualIds = new Set(mutualRows.map(m => m.matchedUserId));

  const { count, rows: views } = await ProfileView.findAndCountAll({
    where: {
      viewedUserId: userId,
      ...(blockedIds.length ? { viewerId: { [Op.notIn]: blockedIds } } : {})
    },
    include: [{
      model: User, as: 'Viewer', attributes: ['id'], where: { status: 'active' },
      include: [{
        model: Profile, where: { isActive: true },
        attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'photoBlurUntilMatch', 'gender', 'dateOfBirth', 'education', 'profession']
      }]
    }],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  const validViewers = views
    .filter(v => v.Viewer?.Profile)
    .map(v => ({
      userId: v.viewerId,
      ...redactForViewer(v.Viewer.Profile.toJSON(), { isMutual: mutualIds.has(v.viewerId), hasPaidAccess: true }),
      viewedAt: v.createdAt
    }));

  res.json({
    success: true,
    viewers: validViewers,
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) }
  });
});

// @route   GET /api/v1/profile/me/recently-viewed
// @desc    Profiles the current user has recently viewed (own activity — all tiers)
// @access  Private
exports.getRecentlyViewed = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;

  // Distinct viewed users, most-recent view first (dedup repeated views)
  const grouped = await ProfileView.findAll({
    where: { viewerId: userId },
    attributes: [
      'viewedUserId',
      [sequelize.fn('MAX', sequelize.col('createdAt')), 'lastViewedAt'],
    ],
    group: ['viewedUserId'],
    order: [[sequelize.fn('MAX', sequelize.col('createdAt')), 'DESC']],
    limit,
    offset,
    raw: true,
  });

  const viewedIds = grouped.map(g => g.viewedUserId).filter(id => id !== userId);

  // Exclude blocked users (either direction)
  const blocks = viewedIds.length
    ? await Block.findAll({
        where: {
          [Op.or]: [
            { blockerId: userId, blockedUserId: { [Op.in]: viewedIds } },
            { blockedUserId: userId, blockerId: { [Op.in]: viewedIds } },
          ],
        },
        attributes: ['blockerId', 'blockedUserId'],
      })
    : [];
  const blockedIds = new Set(blocks.map(b => (b.blockerId === userId ? b.blockedUserId : b.blockerId)));
  const finalIds = viewedIds.filter(id => !blockedIds.has(id));

  const profiles = finalIds.length
    ? await Profile.findAll({
        where: { userId: { [Op.in]: finalIds }, isActive: true },
        attributes: ['userId', 'firstName', 'lastName', 'city', 'profilePhoto', 'photoBlurUntilMatch', 'gender', 'dateOfBirth', 'education', 'profession'],
        // A member who has since been banned or deleted is not shown.
        include: [{ model: User, attributes: [], where: { status: 'active' }, required: true }],
      })
    : [];
  const mutualRows = await Match.findAll({ where: { userId, isMutual: true }, attributes: ['matchedUserId'] });
  const mutualIds = new Set(mutualRows.map(m => m.matchedUserId));

  // Preserve recency order + attach viewedAt timestamp
  const lastViewedMap = Object.fromEntries(grouped.map(g => [g.viewedUserId, g.lastViewedAt]));
  const profileMap = Object.fromEntries(profiles.map(p => [
    p.userId,
    redactForViewer(p.toJSON(), { isMutual: mutualIds.has(p.userId), hasPaidAccess: false })
  ]));
  const ordered = finalIds
    .filter(id => profileMap[id])
    .map(id => ({ ...profileMap[id], viewedAt: lastViewedMap[id] }));

  res.json({
    success: true,
    profiles: ordered,
    pagination: { page, limit },
  });
});

// @route   PUT /api/profile/privacy
// @desc    Update profile privacy settings
// @access  Private
// @route   GET /api/v1/profile/:userId/compatibility
// @desc    Return detailed compatibility breakdown (APP-049 "Why This Match")
// @access  Private
exports.getCompatibilityBreakdown = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const myProfile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!myProfile) throw createError.notFound('Your profile not found');

  const { profile: theirProfile } = await assertProfileVisible(req.user.id, userId, {
    viewerRole: req.user.role,
  });

  const overallScore = calculateCompatibility(myProfile, theirProfile);
  const breakdown = calcBreakdown(myProfile, theirProfile);

  res.json({ success: true, overallScore, breakdown });
});

exports.updatePrivacySettings = asyncHandler(async (req, res) => {
  const { profileVisibility, showOnlineStatus, showLastSeen, fieldVisibility, incognitoMode } = req.body;
  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) throw createError.notFound('Profile not found');

  if (fieldVisibility !== undefined) {
    // Merge so changing one group keeps the other; unknown groups/levels dropped.
    profile.fieldVisibility = { ...(profile.fieldVisibility || {}), ...sanitizeFieldVisibility(fieldVisibility) };
  }

  if (profileVisibility !== undefined) {
    const valid = ['everyone', 'matches_only'];
    if (!valid.includes(profileVisibility)) {
      throw createError.badRequest('Invalid profileVisibility value');
    }
    profile.profileVisibility = profileVisibility;
  }
  if (typeof showOnlineStatus === 'boolean') profile.showOnlineStatus = showOnlineStatus;
  if (typeof showLastSeen === 'boolean') profile.showLastSeen = showLastSeen;
  if (typeof incognitoMode === 'boolean') profile.incognitoMode = incognitoMode;

  await profile.save();

  res.json({ success: true, message: 'Privacy settings updated', profile: {
    profileVisibility: profile.profileVisibility,
    showOnlineStatus: profile.showOnlineStatus,
    showLastSeen: profile.showLastSeen,
    incognitoMode: Boolean(profile.incognitoMode),
    fieldVisibility: profile.fieldVisibility || {},
  }});
});

// @route   POST /api/v1/profile/voice-intro
// @desc    Upload a 30-second voice intro (Premium+ viewers only on playback)
// @access  Private
exports.uploadVoiceIntro = asyncHandler(async (req, res) => {
  if (!req.file) throw createError.badRequest('No audio file provided');

  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) throw createError.notFound('Profile not found');

  // Delete existing voice intro from Cloudinary
  if (profile.voiceIntroUrl) {
    try {
      await deleteFromCloudinary(profile.voiceIntroUrl);
    } catch (err) {
      log.error('Error deleting old voice intro from Cloudinary', { error: err.message });
    }
  }

  const audioUrl = req.file.path || req.file.secure_url || req.file.filename;
  profile.voiceIntroUrl = audioUrl;
  await profile.save();

  res.json({ success: true, voiceIntroUrl: signMediaUrl(audioUrl, MEDIA_TTL.playback) });
});

// @route   DELETE /api/v1/profile/voice-intro
// @desc    Delete voice intro
// @access  Private
exports.deleteVoiceIntro = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) throw createError.notFound('Profile not found');
  if (!profile.voiceIntroUrl) throw createError.notFound('No voice intro to delete');

  try {
    await deleteFromCloudinary(profile.voiceIntroUrl);
  } catch (err) {
    log.error('Error deleting voice intro from Cloudinary', { error: err.message });
  }

  profile.voiceIntroUrl = null;
  await profile.save();

  res.json({ success: true, message: 'Voice intro deleted' });
});

// @route   POST /api/v1/profile/video-intro
// @desc    Upload a short (~30s) video intro
// @access  Private
exports.uploadVideoIntro = asyncHandler(async (req, res) => {
  if (!req.file) throw createError.badRequest('No video file provided');

  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) throw createError.notFound('Profile not found');

  // Delete existing video intro from Cloudinary
  if (profile.videoIntroUrl) {
    try {
      await deleteFromCloudinary(profile.videoIntroUrl);
    } catch (err) {
      log.error('Error deleting old video intro from Cloudinary', { error: err.message });
    }
  }

  const videoUrl = req.file.path || req.file.secure_url || req.file.filename;
  profile.videoIntroUrl = videoUrl;
  await profile.save();

  res.json({ success: true, videoIntroUrl: signMediaUrl(videoUrl, MEDIA_TTL.playback) });
});

// @route   DELETE /api/v1/profile/video-intro
// @desc    Delete video intro
// @access  Private
exports.deleteVideoIntro = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) throw createError.notFound('Profile not found');
  if (!profile.videoIntroUrl) throw createError.notFound('No video intro to delete');

  try {
    await deleteFromCloudinary(profile.videoIntroUrl);
  } catch (err) {
    log.error('Error deleting video intro from Cloudinary', { error: err.message });
  }

  profile.videoIntroUrl = null;
  await profile.save();

  res.json({ success: true, message: 'Video intro deleted' });
});

// @route   GET /api/v1/profile/:userId/horoscope-match
// @desc    Full Ashtakoot Guna Milan + Manglik compatibility (APP-055)
// @access  Private
exports.getHoroscopeMatch = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const myProfile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!myProfile) throw createError.notFound('Your profile not found');

  const { profile: theirProfile } = await assertProfileVisible(req.user.id, userId, {
    viewerRole: req.user.role,
  });

  // Full Ashtakoot if both have nakshatra
  const ashtakoot = getKundliMatch(myProfile, theirProfile);

  // Manglik
  const manglikCompatible = isManglikCompatible(myProfile.manglikStatus, theirProfile.manglikStatus);
  const manglikDetail = (() => {
    if (!myProfile.manglikStatus || !theirProfile.manglikStatus) return 'Manglik status unknown for one or both profiles';
    if (!manglikCompatible) return 'Manglik dosha present — recommend consulting a pandit for remedies';
    if (myProfile.manglikStatus === 'anshik_manglik' || theirProfile.manglikStatus === 'anshik_manglik') return 'Anshik (partial) Manglik — minor consideration only';
    return 'No Manglik dosha';
  })();

  // Rashi fallback score
  const rashiScore = getRashiCompatibility(myProfile.rashi, theirProfile.rashi);

  // Numerology (life-path) — works off DOB, independent of nakshatra
  const numerology = getNumerologyMatch(myProfile.dateOfBirth, theirProfile.dateOfBirth);

  // Summary
  const summary = buildKundliSummary({ ashtakoot, manglikCompatible, manglikDetail, rashiScore });

  res.json({
    success: true,
    ashtakoot: ashtakoot ? { ...ashtakoot, manglikCompatible, manglikDetail } : null,
    manglikCompatible,
    manglikDetail,
    rashiScore,
    numerology,
    summary,
  });
});

// @route   GET /api/v1/profile/:userId/horoscope-match/pdf
// @desc    Downloadable Kundli matchmaking report (Ashtakoot + Manglik + numerology)
// @access  Private (premium)
exports.downloadKundliReport = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const myProfile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!myProfile) throw createError.notFound('Your profile not found');

  const visible = await assertProfileVisible(req.user.id, userId, {
    viewerRole: req.user.role,
  });
  // The report prints the other member's place of birth: honour their choice.
  // Nakshatra, rashi and manglik feed the score itself and stay available.
  const theirProfile = applyFieldVisibility(visible.profile.toJSON(), { isMutual: visible.isMutual, isSelf: visible.isSelf });

  const ashtakoot = getKundliMatch(myProfile, theirProfile);
  const manglikCompatible = isManglikCompatible(myProfile.manglikStatus, theirProfile.manglikStatus);
  const manglikDetail = (() => {
    if (!myProfile.manglikStatus || !theirProfile.manglikStatus) return 'Manglik status unknown for one or both profiles';
    if (!manglikCompatible) return 'Manglik dosha present — recommend consulting a pandit for remedies';
    if (myProfile.manglikStatus === 'anshik_manglik' || theirProfile.manglikStatus === 'anshik_manglik') return 'Anshik (partial) Manglik — minor consideration only';
    return 'No Manglik dosha';
  })();
  const rashiScore = getRashiCompatibility(myProfile.rashi, theirProfile.rashi);
  const numerology = getNumerologyMatch(myProfile.dateOfBirth, theirProfile.dateOfBirth);

  const summary = buildKundliSummary({ ashtakoot, manglikCompatible, manglikDetail, rashiScore, plain: true });

  generateKundliPDF(res, {
    myProfile, theirProfile, ashtakoot, manglikCompatible, manglikDetail, rashiScore, numerology, summary,
  });
});


// ==================== BIODATA PDF (D5 flagship) ====================

// Fetch the profile photo into a buffer BEFORE the PDF stream starts — never
// mid-stream (kundli-pdf-crash class). 2s timeout, silent skip on any failure.
// ES12: pins a Cloudinary f_jpg transform — profile photos are often served as
// webp via f_auto and pdfkit decodes only JPEG/PNG.
const fetchBiodataPhoto = async (url) => {
  if (!url || !/^https?:\/\//.test(url)) return null; // dev-relative /uploads/* paths have no fetchable host
  const jpgUrl = url.includes('/upload/')
    ? url.replace('/upload/', '/upload/f_jpg,w_400,h_500,c_fill/')
    : url;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const resp = await fetch(jpgUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
};

// @route   GET /api/profile/me/biodata?template=classic|modern
// @desc    Download own marriage-biodata PDF. FREE for every tier — the
//          branded footer on a WhatsApp-forwarded PDF is the acquisition loop.
// @access  Private
exports.downloadBiodata = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) {
    throw createError.notFound('Complete your profile first');
  }

  const template = BIODATA_TEMPLATES[req.query.template] ? req.query.template : 'classic';

  // Owner decision 2026-08-19: photo in v1 — buffered before doc.pipe(res).
  const photoBuffer = await fetchBiodataPhoto(profile.profilePhoto);

  trackEvent(req.user.id, 'biodata_downloaded');

  generateBiodataPDF(res, {
    profile: profile.toJSON(),
    template,
    photoBuffer,
    profileCode: toProfileCode(req.user.id),
  });
});


// @route   POST /api/profile/me/pause
// @desc    Hide my profile from everyone until I resume it
// @access  Private
exports.pauseMyProfile = asyncHandler(async (req, res) => {
  const { pauseProfile } = require('../utils/accountLifecycle');
  const result = await pauseProfile(req.user.id);
  res.json({ success: true, paused: true, pausedAt: result.pausedAt || null });
});

// @route   POST /api/profile/me/resume
// @desc    Make my profile visible again
// @access  Private
exports.resumeMyProfile = asyncHandler(async (req, res) => {
  const { resumeProfile } = require('../utils/accountLifecycle');
  const result = await resumeProfile(req.user.id);
  if (result.reason === 'deletion_scheduled') {
    throw createError.conflict('Your account is scheduled for deletion. Cancel the deletion first.', 'DELETION_SCHEDULED');
  }
  res.json({ success: true, paused: false });
});
