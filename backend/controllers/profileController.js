/**
 * Profile Controller
 * Handles user profile management with proper security
 */

const { Profile, User, ProfileView, Subscription, Match, ContactUnlock, Block } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { calculateCompatibility, getCompatibilityBreakdown: calcBreakdown, getAshtakootScore, isManglikCompatible, getRashiCompatibility } = require('../utils/compatibility');
const { getNumerologyMatch } = require('../utils/numerology');
const { generateKundliPDF } = require('../utils/kundli');
const { notify } = require('../utils/notifyUser');

// Completion milestones and their messages
const COMPLETION_MILESTONES = [
  { pct: 50, title: 'Profile 50% complete!', body: 'Add your education & profession to boost your matches.' },
  { pct: 70, title: 'Profile 70% complete!', body: 'Upload your Kundli to reach 80%+ and appear in more searches.' },
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

  // Personality info
  if (profile.personalityValues && Object.keys(profile.personalityValues).length > 0) completed += 2;
  if (profile.familyPreferences && Object.keys(profile.familyPreferences).length > 0) completed += 2;

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

  const payload = profile.get ? profile.get({ plain: true }) : profile.toJSON();
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

  // Allowlisted profile fields — NEVER spread req.body directly to prevent mass-assignment
  const PROFILE_UPDATABLE_FIELDS = [
    'firstName', 'lastName', 'gender', 'dateOfBirth', 'height', 'weight',
    'city', 'state', 'skinTone', 'diet', 'smoking', 'drinking',
    'education', 'degree', 'profession', 'income',
    'religion', 'caste', 'subCaste', 'gotra', 'motherTongue', 'maritalStatus', 'numberOfChildren',
    'placeOfBirth', 'birthTime', 'manglikStatus', 'zodiacSign', 'rashi', 'nakshatra',
    'familyType', 'familyStatus', 'fatherOccupation', 'motherOccupation',
    'preferredAgeMin', 'preferredAgeMax', 'preferredHeightMin', 'preferredHeightMax',
    'preferredEducation', 'preferredProfession', 'preferredCity',
    'personalityValues', 'familyPreferences', 'lifestylePreferences',
    'bio', 'showPhone', 'showEmail', 'interestTags', 'profilePrompts',
    'spotifyPlaylist', 'socialMediaLinks', 'personalityType', 'languages',
    'incognitoMode', 'photoBlurUntilMatch', 'quizAnswers',
    'onboardingComplete',
  ];

  // Use transaction for data consistency
  await sequelize.transaction(async (t) => {
    // Build updateData from ONLY allowlisted fields — prevents mass-assignment
    const bodyProfilePhoto = req.body?.profilePhoto;
    const updateData = {};
    
    // Fields that must be arrays in the database (excluding photos which is handled separately)
    const arrayFields = ['preferredCity', 'interestTags', 'languages'];
    // Fields that must be JSON in the database
    const jsonFields = ['personalityValues', 'familyPreferences', 'lifestylePreferences', 'profilePrompts', 'quizAnswers'];
    
    for (const field of PROFILE_UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        let value = req.body[field];
        
        if (arrayFields.includes(field)) {
          // If multer parsed a single appended element, it's a string. Make it an array.
          updateData[field] = typeof value === 'string' ? (value ? [value] : []) : value;
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
            'religion', 'caste', 'subCaste', 'gotra', 'motherTongue', 'placeOfBirth',
            'birthTime', 'rashi', 'nakshatra', 'zodiacSign', 'fatherOccupation', 'motherOccupation',
            'preferredEducation', 'preferredProfession', 'firstName', 'lastName', 'personalityType'];
          if (freeTextFields.includes(field) && typeof value === 'string') {
            value = value.replace(/<[^>]*>/g, '').trim();
          }
          updateData[field] = value;
        }
      }
    }

    // Don't overwrite critical fields with empty — keeps suggestions/discovery working (e.g. gender)
    const criticalFields = ['gender', 'firstName', 'lastName'];
    criticalFields.forEach((key) => {
      const v = updateData[key];
      if (v === '' || v === null || v === undefined) delete updateData[key];
    });

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

    updateData.photos = finalPhotos;
    updateData.profilePhoto = finalProfilePhoto || null;

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

  // Reload once more so response has latest DB state; send plain object so client gets photos array
  await profile.reload();
  const payload = profile.get ? profile.get({ plain: true }) : profile.toJSON();

  if (process.env.NODE_ENV === 'development' && payload.photos?.length) {
    console.log('[profile] Responding with photos count:', payload.photos.length);
  }

  res.json({
    success: true,
    profile: payload,
    message: 'Profile updated successfully'
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

  res.json({
    success: true,
    message: 'Profile photo deleted successfully'
  });
});

// @route   GET /api/profile/:userId
// @desc    Get user profile by ID (with privacy checks)
// @access  Private
exports.getProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const viewerId = req.user.id;

  if (userId === viewerId) {
    return exports.getMyProfile(req, res);
  }

  const profile = await Profile.findOne({
    where: { userId, isActive: true },
    include: [
      {
        model: User,
        // Only fetch fields safe to return publicly; contact details are gated below
        attributes: ['id', 'status'],
        include: [{ model: Subscription, where: { status: 'active' }, required: false }]
      }
    ]
  });

  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  // Check subscription for contact visibility
  const viewerSubscription = await Subscription.findOne({
    where: { userId: viewerId, status: 'active' }
  });

  const hasPremiumAccess = viewerSubscription &&
    ['basic_premium', 'premium_plus', 'vip'].includes(viewerSubscription.planType);

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
  if (!viewerProfile?.incognitoMode) {
    try {
      await ProfileView.create({ viewerId, viewedUserId: userId });
    } catch (err) {
      // CTRL-2: only the unique-constraint (already-viewed) case is expected;
      // surface anything else instead of silently swallowing it.
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }
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

  // Prepare response with privacy checks
  const profileData = profile.toJSON();

  // (Incognito handling moved up — the view is simply not recorded when the
  // viewer browses in incognito mode. See CTRL-1.)

  // Enforce photo blur: replace photo URLs with null for non-mutual viewers when photoBlurUntilMatch is set
  if (profile.photoBlurUntilMatch && !isMutual) {
    profileData.profilePhoto = null;
    profileData.photos = [];
  }

  // Only fetch contact details from DB when the viewer has actually earned access.
  // This prevents any accidental leakage through JSON serialisation.
  if (hasPremiumAccess && isContactUnlocked) {
    const targetUser = await User.findByPk(userId, { attributes: ['phone', 'email'] });
    if (profileData.User) {
      profileData.User.phone = targetUser?.phone ?? null;
      profileData.User.email = targetUser?.email ?? null;
    } else {
      profileData.contactPhone = targetUser?.phone ?? null;
      profileData.contactEmail = targetUser?.email ?? null;
    }
  } else {
    if (profileData.User) {
      delete profileData.User.phone;
      delete profileData.User.email;
    }
    profileData.socialMediaLinks = null;
  }

  // Check if target user has premium (for badge display)
  const targetSubscription = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      planType: { [Op.in]: ['basic_premium', 'premium_plus', 'vip'] },
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

  const [viewsThisWeek, totalViews, likesReceived, likesByCity] = await Promise.all([
    ProfileView.count({
      where: { viewedUserId: userId, createdAt: { [Op.gte]: weekAgo } }
    }),
    ProfileView.count({
      where: { viewedUserId: userId }
    }),
    Match.count({
      where: { matchedUserId: userId, action: 'like' }
    }),
    Match.findAll({
      where: { matchedUserId: userId, action: 'like' },
      include: [{
        model: User, as: 'User', attributes: ['id'],
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
  if (existing) {
    const tp = await Profile.findOne({
      where: { userId: targetUserId },
      include: [{ model: User, attributes: ['email', 'phone'] }]
    });
    return res.json({
      success: true,
      alreadyUnlocked: true,
      contact: { phone: tp?.User?.phone || null, email: tp?.User?.email || null }
    });
  }

  const result = await sequelize.transaction(async (t) => {
    await ContactUnlock.create({ userId, targetUserId }, { transaction: t });

    const subscription = req.subscription;
    if (subscription.contactUnlocksAllowed !== null) {
      subscription.contactUnlocksUsed = (subscription.contactUnlocksUsed || 0) + 1;
      await subscription.save({ transaction: t });
    }

    const tp = await Profile.findOne({
      where: { userId: targetUserId },
      include: [{ model: User, attributes: ['email', 'phone'] }],
      transaction: t
    });

    return {
      contact: { phone: tp?.User?.phone || null, email: tp?.User?.email || null },
      remaining: subscription.contactUnlocksAllowed === null
        ? -1
        : Math.max(0, subscription.contactUnlocksAllowed - (subscription.contactUnlocksUsed || 0))
    };
  });

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

  const { count, rows: views } = await ProfileView.findAndCountAll({
    where: { viewedUserId: userId },
    include: [{
      model: User, as: 'Viewer', attributes: ['id'],
      include: [{
        model: Profile, where: { isActive: true },
        attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'gender', 'dateOfBirth', 'education', 'profession']
      }]
    }],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  const validViewers = views
    .filter(v => v.Viewer?.Profile)
    .map(v => ({ userId: v.viewerId, ...v.Viewer.Profile.toJSON(), viewedAt: v.createdAt }));

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
        attributes: ['userId', 'firstName', 'lastName', 'city', 'profilePhoto', 'gender', 'dateOfBirth', 'education', 'profession'],
      })
    : [];

  // Preserve recency order + attach viewedAt timestamp
  const lastViewedMap = Object.fromEntries(grouped.map(g => [g.viewedUserId, g.lastViewedAt]));
  const profileMap = Object.fromEntries(profiles.map(p => [p.userId, p.toJSON()]));
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
  const [myProfile, theirProfile] = await Promise.all([
    Profile.findOne({ where: { userId: req.user.id } }),
    Profile.findOne({ where: { userId } }),
  ]);
  if (!myProfile) throw createError.notFound('Your profile not found');
  if (!theirProfile) throw createError.notFound('Profile not found');

  const overallScore = calculateCompatibility(myProfile, theirProfile);
  const breakdown = calcBreakdown(myProfile, theirProfile);

  res.json({ success: true, overallScore, breakdown });
});

exports.updatePrivacySettings = asyncHandler(async (req, res) => {
  const { profileVisibility, showOnlineStatus, showLastSeen } = req.body;
  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) throw createError.notFound('Profile not found');

  if (profileVisibility !== undefined) {
    const valid = ['everyone', 'matches_only'];
    if (!valid.includes(profileVisibility)) {
      throw createError.badRequest('Invalid profileVisibility value');
    }
    profile.profileVisibility = profileVisibility;
  }
  if (typeof showOnlineStatus === 'boolean') profile.showOnlineStatus = showOnlineStatus;
  if (typeof showLastSeen === 'boolean') profile.showLastSeen = showLastSeen;

  await profile.save();

  res.json({ success: true, message: 'Privacy settings updated', profile: {
    profileVisibility: profile.profileVisibility,
    showOnlineStatus: profile.showOnlineStatus,
    showLastSeen: profile.showLastSeen,
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

  res.json({ success: true, voiceIntroUrl: audioUrl });
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

  res.json({ success: true, videoIntroUrl: videoUrl });
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
  const [myProfile, theirProfile] = await Promise.all([
    Profile.findOne({ where: { userId: req.user.id } }),
    Profile.findOne({ where: { userId } }),
  ]);
  if (!myProfile) throw createError.notFound('Your profile not found');
  if (!theirProfile) throw createError.notFound('Profile not found');

  // Full Ashtakoot if both have nakshatra
  const ashtakoot = getAshtakootScore(myProfile.nakshatra, theirProfile.nakshatra);

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
  let summary = '';
  if (ashtakoot) {
    const score = ashtakoot.rawOut36 ?? 0;
    summary = `Guna Milan: ${score}/36 (${ashtakoot.interpretation}).`;
    if (ashtakoot.hasNadiDosha) summary += ' ⚠️ Nadi Dosha present.';
    if (ashtakoot.hasBhakootDosha) summary += ' ⚠️ Bhakoot Dosha present.';
    if (!manglikCompatible) summary += ' ⚠️ Manglik incompatibility.';
    if (score >= 28 && manglikCompatible) summary += ' Excellent match for marriage.';
  } else if (rashiScore !== null) {
    summary = `Rashi compatibility: ${rashiScore}%. ${manglikDetail}.`;
  } else {
    summary = 'Insufficient horoscope data for full analysis. Please complete nakshatra and birth details.';
  }

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
  const [myProfile, theirProfile] = await Promise.all([
    Profile.findOne({ where: { userId: req.user.id } }),
    Profile.findOne({ where: { userId } }),
  ]);
  if (!myProfile) throw createError.notFound('Your profile not found');
  if (!theirProfile) throw createError.notFound('Profile not found');

  const ashtakoot = getAshtakootScore(myProfile.nakshatra, theirProfile.nakshatra);
  const manglikCompatible = isManglikCompatible(myProfile.manglikStatus, theirProfile.manglikStatus);
  const manglikDetail = (() => {
    if (!myProfile.manglikStatus || !theirProfile.manglikStatus) return 'Manglik status unknown for one or both profiles';
    if (!manglikCompatible) return 'Manglik dosha present — recommend consulting a pandit for remedies';
    if (myProfile.manglikStatus === 'anshik_manglik' || theirProfile.manglikStatus === 'anshik_manglik') return 'Anshik (partial) Manglik — minor consideration only';
    return 'No Manglik dosha';
  })();
  const rashiScore = getRashiCompatibility(myProfile.rashi, theirProfile.rashi);
  const numerology = getNumerologyMatch(myProfile.dateOfBirth, theirProfile.dateOfBirth);

  let summary = '';
  if (ashtakoot) {
    const score = ashtakoot.rawOut36 ?? 0;
    summary = `Guna Milan: ${score}/36 (${ashtakoot.interpretation}).`;
    if (ashtakoot.hasNadiDosha) summary += ' Nadi Dosha present.';
    if (ashtakoot.hasBhakootDosha) summary += ' Bhakoot Dosha present.';
    if (!manglikCompatible) summary += ' Manglik incompatibility.';
    if (score >= 28 && manglikCompatible) summary += ' Excellent match for marriage.';
  } else if (rashiScore !== null) {
    summary = `Rashi compatibility: ${rashiScore}%. ${manglikDetail}.`;
  } else {
    summary = 'Insufficient horoscope data for full analysis. Please complete nakshatra and birth details.';
  }

  generateKundliPDF(res, {
    myProfile, theirProfile, ashtakoot, manglikCompatible, manglikDetail, rashiScore, numerology, summary,
  });
});
