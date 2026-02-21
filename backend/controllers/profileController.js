/**
 * Profile Controller
 * Handles user profile management with proper security
 */

const { Profile, User, ProfileView, Subscription, Match } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { calculateCompatibility } = require('../utils/compatibility');
const { deleteFromCloudinary } = require('../middlewares/upload');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');

// Maximum number of gallery photos allowed
const MAX_GALLERY_PHOTOS = config.upload.maxGalleryPhotos;

// Calculate profile completion percentage based on IMPORTANT fields only
const calculateCompletion = (profile) => {
  if (!profile) return 0;

  let completed = 0;
  let total = 0;

  // ===== REQUIRED FIELDS (40%) - Must have for basic profile =====
  total += 40;
  if (profile.firstName && profile.firstName.trim()) completed += 8;
  if (profile.lastName && profile.lastName.trim()) completed += 8;
  if (profile.gender) completed += 8;
  if (profile.dateOfBirth) completed += 8;
  if (profile.city && profile.city.trim()) completed += 8;

  // ===== IMPORTANT FIELDS (50%) - Highly recommended =====
  total += 50;

  // Physical Info (10%)
  if (profile.height) completed += 5;
  if (profile.weight) completed += 5;

  // Education & Career (15%)
  if (profile.education && profile.education.trim()) completed += 7.5;
  if (profile.profession && profile.profession.trim()) completed += 7.5;

  // Profile Photo (10%) - Very important for matches
  if (profile.profilePhoto) completed += 10;

  // Bio (10%) - Important for personality
  if (profile.bio && profile.bio.trim().length >= 20) completed += 10;

  // Lifestyle Preferences (5%) - At least one lifestyle field
  let lifestyleCount = 0;
  if (profile.diet) lifestyleCount++;
  if (profile.smoking) lifestyleCount++;
  if (profile.drinking) lifestyleCount++;
  if (lifestyleCount > 0) completed += 5;

  // ===== OPTIONAL ENHANCEMENTS (10%) - Nice to have =====
  total += 10;

  // Additional photos
  if (profile.photos && profile.photos.length > 0) completed += 3;

  // Personality info
  if (profile.personalityValues && Object.keys(profile.personalityValues).length > 0) completed += 2;
  if (profile.familyPreferences && Object.keys(profile.familyPreferences).length > 0) completed += 2;

  // Interest tags
  if (profile.interestTags && profile.interestTags.length > 0) completed += 3;

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

  // Use transaction for data consistency
  await sequelize.transaction(async (t) => {
    // Update profile fields (exclude profilePhoto from body here; we set it from gallery or file)
    const { profilePhoto: bodyProfilePhoto, ...restBody } = req.body;
    const updateData = { ...restBody };

    // Normalize file path: Cloudinary returns full URL; local storage returns path — store URL path for local
    const getStoredPath = (file) => {
      if (!file || !file.path) return null;
      if (String(file.path).includes('cloudinary')) return file.path;
      return `/uploads/${file.filename || file.path.replace(/^.*[/\\]/, '')}`;
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
              console.error('Error deleting excess photo:', err);
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
  const completion = calculateCompletion(profileData);

  profile.completionPercentage = completion;
  await profile.save();

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
    console.error('Error deleting photo from Cloudinary:', err);
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
    console.error('Error deleting profile photo from Cloudinary:', err);
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

  // Check if viewing own profile
  if (userId === viewerId) {
    return exports.getMyProfile(req, res);
  }

  const profile = await Profile.findOne({
    where: { userId, isActive: true },
    include: [
      {
        model: User,
        attributes: ['id', 'email', 'phone', 'status'],
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
    ['premium', 'elite'].includes(viewerSubscription.planType);

  // Record profile view (batch to prevent duplicates in short time)
  try {
    await ProfileView.create({
      viewerId,
      viewedUserId: userId
    });
  } catch (err) {
    // Ignore duplicate errors
  }

  // Calculate compatibility
  const viewerProfile = await Profile.findOne({ where: { userId: viewerId } });
  let compatibilityScore = null;
  if (viewerProfile) {
    compatibilityScore = calculateCompatibility(viewerProfile, profile);
  }

  // Check match status
  const existingMatch = await Match.findOne({
    where: {
      userId: viewerId,
      matchedUserId: userId
    }
  });

  const isLiked = existingMatch && existingMatch.action === 'like';
  const isShortlisted = existingMatch && existingMatch.action === 'shortlist';

  // Prepare response with privacy checks
  const profileData = profile.toJSON();
  if (!hasPremiumAccess) {
    if (profileData.User) {
      profileData.User.phone = null;
      profileData.User.email = null;
    }
    profileData.socialMediaLinks = null;
  }

  res.json({
    success: true,
    profile: profileData,
    compatibilityScore,
    hasPremiumAccess,
    isLiked,
    isShortlisted
  });
});

// @route   GET /api/profile/me/stats
// @desc    Get profile engagement stats
// @access  Private
exports.getProfileStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel for better performance
  const [viewsThisWeek, totalViews, likesReceived, likesByCity] = await Promise.all([
    ProfileView.count({
      where: {
        viewedUserId: userId,
        createdAt: { [Op.gte]: weekAgo }
      }
    }),
    ProfileView.count({
      where: { viewedUserId: userId }
    }),
    Match.count({
      where: {
        matchedUserId: userId,
        action: 'like'
      }
    }),
    Match.findAll({
      where: {
        matchedUserId: userId,
        action: 'like'
      },
      include: [{
        model: User,
        as: 'User',
        attributes: ['id'],
        include: [{
          model: Profile,
          attributes: ['city']
        }]
      }],
      attributes: ['id']
    })
  ]);

  // Process city counts in memory
  const cityCounts = {};
  likesByCity.forEach(match => {
    const city = match.User?.Profile?.city || 'Unknown';
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  res.json({
    success: true,
    stats: {
      viewsThisWeek,
      totalViews,
      likesReceived,
      likesByCity: cityCounts
    }
  });
});
