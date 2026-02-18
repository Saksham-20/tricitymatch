/**
 * Search Controller
 * Handles profile search with optimized queries
 */

const { Profile, User, Match, Subscription } = require('../models');
const { Op } = require('sequelize');
const { calculateCompatibility } = require('../utils/compatibility');
const { createError, asyncHandler } = require('../middlewares/errorHandler');

// Escape special characters for LIKE patterns to prevent injection
const escapeLikePattern = (str) => {
  if (!str) return str;
  return str.replace(/[%_\\]/g, '\\$&');
};

// @route   GET /api/search
// @desc    Search profiles with filters
// @access  Private
exports.searchProfiles = asyncHandler(async (req, res) => {
  const {
    ageMin,
    ageMax,
    heightMin,
    heightMax,
    city,
    education,
    profession,
    diet,
    smoking,
    drinking,
    interestTags,
    page = 1,
    limit = 20,
    sortBy = 'compatibility'
  } = req.query;

  const userId = req.user.id;
  const offset = (page - 1) * limit;

  // Get current user's profile for compatibility calculation
  const currentProfile = await Profile.findOne({ where: { userId } });
  if (!currentProfile) {
    throw createError.badRequest('Please complete your profile first');
  }

  // Build where clause
  const where = {
    isActive: true,
    userId: { [Op.ne]: userId } // Exclude self
  };

  // Gender filter (opposite gender by default)
  const oppositeGender = currentProfile.gender === 'male' ? 'female' :
    currentProfile.gender === 'female' ? 'male' : 'other';
  where.gender = oppositeGender;

  // Age filter
  if (ageMin || ageMax) {
    const now = new Date();
    const minDate = ageMax ? new Date(now.getFullYear() - ageMax - 1, now.getMonth(), now.getDate()) : null;
    const maxDate = ageMin ? new Date(now.getFullYear() - ageMin, now.getMonth(), now.getDate()) : null;

    if (minDate && maxDate) {
      where.dateOfBirth = { [Op.between]: [minDate, maxDate] };
    } else if (minDate) {
      where.dateOfBirth = { [Op.lte]: minDate };
    } else if (maxDate) {
      where.dateOfBirth = { [Op.gte]: maxDate };
    }
  }

  // Height filter
  if (heightMin || heightMax) {
    where.height = {};
    if (heightMin) where.height[Op.gte] = parseInt(heightMin);
    if (heightMax) where.height[Op.lte] = parseInt(heightMax);
  }

  // City filter
  if (city) {
    where.city = city;
  }

  // Education filter
  if (education) {
    where.education = education;
  }

  // Profession filter (escape special characters)
  if (profession) {
    where.profession = { [Op.iLike]: `%${escapeLikePattern(profession)}%` };
  }

  // Lifestyle filters
  if (diet) where.diet = diet;
  if (smoking) where.smoking = smoking;
  if (drinking) where.drinking = drinking;

  // Interest tags filter
  if (interestTags) {
    const tags = Array.isArray(interestTags) ? interestTags : [interestTags];
    where.interestTags = {
      [Op.overlap]: tags
    };
  }

  // Get profiles
  const profiles = await Profile.findAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'email', 'status'],
        where: { status: 'active' }
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  // Batch query for match statuses (fixes N+1)
  const profileUserIds = profiles.map(p => p.userId);
  const existingMatches = profileUserIds.length > 0
    ? await Match.findAll({
      where: {
        userId,
        matchedUserId: { [Op.in]: profileUserIds }
      }
    })
    : [];

  // Create lookup map
  const matchMap = new Map();
  existingMatches.forEach(match => {
    matchMap.set(match.matchedUserId, match);
  });

  // Calculate compatibility for each profile
  const profilesWithCompatibility = profiles.map((profile) => {
    const compatibilityScore = calculateCompatibility(currentProfile, profile);
    const match = matchMap.get(profile.userId);

    const raw = profile.toJSON();
    const profileData = {
      ...raw,
      userId: raw.userId || raw.User?.id || profile.userId,
      compatibilityScore,
      matchStatus: match ? match.action : null,
      isMutual: match ? match.isMutual : false
    };

    // Remove nested User object
    if (profileData.User) {
      delete profileData.User;
    }

    return profileData;
  });

  // Sort by compatibility if requested
  if (sortBy === 'compatibility') {
    profilesWithCompatibility.sort((a, b) =>
      (b.compatibilityScore || 0) - (a.compatibilityScore || 0)
    );
  }

  // Get total count
  const total = await Profile.count({ where });

  res.json({
    success: true,
    profiles: profilesWithCompatibility,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @route   GET /api/search/suggestions
// @desc    Get compatibility-based profile suggestions
// @access  Private
exports.getSuggestions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 10;

  const currentProfile = await Profile.findOne({ where: { userId } });
  if (!currentProfile) {
    throw createError.badRequest('Please complete your profile first');
  }

  // Get opposite gender
  const oppositeGender = currentProfile.gender === 'male' ? 'female' :
    currentProfile.gender === 'female' ? 'male' : 'other';

  // Get profiles user hasn't interacted with
  const interactedUserIds = await Match.findAll({
    where: { userId },
    attributes: ['matchedUserId']
  }).then(matches => matches.map(m => m.matchedUserId));

  const profiles = await Profile.findAll({
    where: {
      isActive: true,
      userId: { [Op.ne]: userId, [Op.notIn]: interactedUserIds },
      gender: oppositeGender
    },
    include: [
      {
        model: User,
        attributes: ['id', 'status'],
        where: { status: 'active' }
      }
    ],
    limit: limit * 2 // Get more to filter by compatibility
  });

  // Calculate compatibility and sort
  const profilesWithCompatibility = profiles.map(profile => ({
    profile,
    compatibilityScore: calculateCompatibility(currentProfile, profile)
  }));

  profilesWithCompatibility.sort((a, b) =>
    b.compatibilityScore - a.compatibilityScore
  );

  // Return top matches
  const topMatches = profilesWithCompatibility
    .slice(0, limit)
    .map(item => {
      const raw = item.profile.toJSON();
      const profileData = {
        ...raw,
        userId: raw.userId || raw.User?.id || item.profile.userId,
        compatibilityScore: item.compatibilityScore
      };

      if (profileData.User) {
        delete profileData.User;
      }

      return profileData;
    });

  res.json({
    success: true,
    suggestions: topMatches
  });
});
