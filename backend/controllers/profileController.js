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

  res.json({
    success: true,
    profile
  });
});

// @route   PUT /api/profile/me
// @desc    Update user's profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ where: { userId: req.user.id } });

  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  // Use transaction for data consistency
  await sequelize.transaction(async (t) => {
    // Update profile fields
    const updateData = { ...req.body };

    // Handle photo uploads
    if (req.files) {
      // Handle gallery photos
      if (req.files.photos) {
        const newPhotoPaths = req.files.photos.map(file => file.path);
        const existingPhotos = profile.photos || [];
        const combinedPhotos = [...existingPhotos, ...newPhotoPaths];

        // Limit to MAX_GALLERY_PHOTOS
        if (combinedPhotos.length > MAX_GALLERY_PHOTOS) {
          const photosToDelete = combinedPhotos.slice(MAX_GALLERY_PHOTOS);
          for (const photoUrl of photosToDelete) {
            try {
              await deleteFromCloudinary(photoUrl);
            } catch (err) {
              console.error('Error deleting excess photo:', err);
            }
          }
          updateData.photos = combinedPhotos.slice(0, MAX_GALLERY_PHOTOS);
        } else {
          updateData.photos = combinedPhotos;
        }
      }

      // Handle profile photo
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        // Delete old profile photo from Cloudinary if exists
        if (profile.profilePhoto) {
          try {
            await deleteFromCloudinary(profile.profilePhoto);
          } catch (err) {
            console.error('Error deleting old profile photo:', err);
          }
        }
        updateData.profilePhoto = req.files.profilePhoto[0].path;
      }
    }

    // Update profile with new data
    await profile.update(updateData, { transaction: t });
  });

  // Reload and recalculate completion
  await profile.reload();
  const profileData = profile.toJSON();
  const completion = calculateCompletion(profileData);

  profile.completionPercentage = completion;
  await profile.save();

  res.json({
    success: true,
    profile,
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

  const photos = profile.photos || [];
  const photoIndex = photos.indexOf(photoUrl);

  if (photoIndex === -1) {
    throw createError.notFound('Photo not found in gallery');
  }

  // Delete from Cloudinary
  try {
    await deleteFromCloudinary(photoUrl);
  } catch (err) {
    console.error('Error deleting photo from Cloudinary:', err);
  }

  // Remove from photos array
  photos.splice(photoIndex, 1);
  profile.photos = photos;
  await profile.save();

  // Recalculate completion
  await profile.reload();
  const profileData = profile.toJSON();
  const completion = calculateCompletion(profileData);
  profile.completionPercentage = completion;
  await profile.save();

  res.json({
    success: true,
    message: 'Photo deleted successfully',
    photos: profile.photos
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

  // Delete from Cloudinary
  try {
    await deleteFromCloudinary(profile.profilePhoto);
  } catch (err) {
    console.error('Error deleting profile photo from Cloudinary:', err);
  }

  // Remove from profile
  profile.profilePhoto = null;
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
