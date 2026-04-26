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
    sortBy = 'compatibility'
  } = req.query;

  const userId = req.user.id;
  // Enforce hard limits — do not trust validator alone
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
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

  // Gender filter: opposite gender when set; otherwise both so results aren't empty
  const gender = (currentProfile.gender || '').toLowerCase();
  if (gender === 'male') where.gender = 'female';
  else if (gender === 'female') where.gender = 'male';
  else where.gender = { [Op.in]: ['male', 'female'] };

  // Age filter
  if (ageMin || ageMax) {
    const now = new Date();
    const minDate = ageMax ? new Date(now.getFullYear() - ageMax - 1, now.getMonth(), now.getDate()) : null;
    const maxDate = ageMin ? new Date(now.getFullYear() - ageMin, now.getMonth(), now.getDate()) : null;

    if (minDate && maxDate) {
      where.dateOfBirth = { [Op.between]: [minDate, maxDate] };
    } else if (minDate) {
      where.dateOfBirth = { [Op.gte]: minDate };
    } else if (maxDate) {
      where.dateOfBirth = { [Op.lte]: maxDate };
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
    where.city = { [Op.iLike]: `%${escapeLikePattern(city)}%` };
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
  const [existingMatches, activeSubscriptions] = await Promise.all([
    profileUserIds.length > 0
      ? Match.findAll({
        where: {
          userId,
          matchedUserId: { [Op.in]: profileUserIds }
        }
      })
      : [],
    profileUserIds.length > 0
      ? Subscription.findAll({
        where: {
          userId: { [Op.in]: profileUserIds },
          status: 'active',
          planType: { [Op.in]: ['basic_premium', 'premium_plus', 'vip'] },
          [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
        },
        attributes: ['userId', 'planType']
      })
      : []
  ]);

  // Create lookup maps
  const matchMap = new Map();
  existingMatches.forEach(match => {
    matchMap.set(match.matchedUserId, match);
  });

  // Keep highest plan per user (vip > premium_plus > basic_premium)
  const planRank = { vip: 3, premium_plus: 2, basic_premium: 1 };
  const subMap = new Map();
  activeSubscriptions.forEach(s => {
    const existing = subMap.get(s.userId);
    if (!existing || (planRank[s.planType] || 0) > (planRank[existing] || 0)) {
      subMap.set(s.userId, s.planType);
    }
  });

  // Calculate compatibility for each profile
  const profilesWithCompatibility = profiles.map((profile) => {
    const compatibilityScore = calculateCompatibility(currentProfile, profile);
    const match = matchMap.get(profile.userId);
    const premiumPlan = subMap.get(profile.userId) || null;

    const raw = profile.toJSON();
    const profileData = {
      ...raw,
      userId: raw.userId || raw.User?.id || profile.userId,
      compatibilityScore,
      matchStatus: match ? match.action : null,
      isMutual: match ? match.isMutual : false,
      isPremium: !!premiumPlan,
      premiumPlan
    };

    // Remove nested User object
    if (profileData.User) {
      delete profileData.User;
    }

    return profileData;
  });

  // Boost premium members toward the top while preserving compatibility ordering
  const premiumBoost = (plan) => {
    if (plan === 'vip') return 20;
    if (plan === 'premium_plus') return 10;
    if (plan === 'basic_premium') return 5;
    return 0;
  };

  // Sort by compatibility if requested (premium members get a boost)
  if (sortBy === 'compatibility') {
    profilesWithCompatibility.sort((a, b) => {
      const scoreA = (a.compatibilityScore || 0) + premiumBoost(a.premiumPlan);
      const scoreB = (b.compatibilityScore || 0) + premiumBoost(b.premiumPlan);
      return scoreB - scoreA;
    });
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
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  const currentProfile = await Profile.findOne({ where: { userId } });
  if (!currentProfile) {
    throw createError.badRequest('Please complete your profile first');
  }

  // Prefer opposite gender; if current user's gender is missing/other, show both so suggestions aren't empty
  const gender = (currentProfile.gender || '').toLowerCase();
  const genderFilter = gender === 'male'
    ? { gender: 'female' }
    : gender === 'female'
      ? { gender: 'male' }
      : { gender: { [Op.in]: ['male', 'female'] } };

  // Get profiles user hasn't interacted with
  const interactedUserIds = await Match.findAll({
    where: { userId },
    attributes: ['matchedUserId']
  }).then(matches => matches.map(m => m.matchedUserId));

  const profiles = await Profile.findAll({
    where: {
      isActive: true,
      userId: { [Op.ne]: userId, [Op.notIn]: interactedUserIds },
      ...genderFilter
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

  // Batch-fetch active subscriptions for suggestion profiles
  const suggestionUserIds = profiles.map(p => p.userId);
  const suggestionSubs = suggestionUserIds.length > 0
    ? await Subscription.findAll({
      where: {
        userId: { [Op.in]: suggestionUserIds },
        status: 'active',
        planType: { [Op.in]: ['basic_premium', 'premium_plus', 'vip'] },
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
      },
      attributes: ['userId', 'planType']
    })
    : [];

  const planRankSug = { vip: 3, premium_plus: 2, basic_premium: 1 };
  const subMapSug = new Map();
  suggestionSubs.forEach(s => {
    const existing = subMapSug.get(s.userId);
    if (!existing || (planRankSug[s.planType] || 0) > (planRankSug[existing] || 0)) {
      subMapSug.set(s.userId, s.planType);
    }
  });

  // Calculate compatibility and sort (with premium boost)
  const premiumBoostSug = (plan) => {
    if (plan === 'vip') return 20;
    if (plan === 'premium_plus') return 10;
    if (plan === 'basic_premium') return 5;
    return 0;
  };

  const profilesWithCompatibility = profiles.map(profile => ({
    profile,
    compatibilityScore: calculateCompatibility(currentProfile, profile),
    premiumPlan: subMapSug.get(profile.userId) || null
  }));

  profilesWithCompatibility.sort((a, b) => {
    const scoreA = a.compatibilityScore + premiumBoostSug(a.premiumPlan);
    const scoreB = b.compatibilityScore + premiumBoostSug(b.premiumPlan);
    return scoreB - scoreA;
  });

  // Return top matches
  const topMatches = profilesWithCompatibility
    .slice(0, limit)
    .map(item => {
      const raw = item.profile.toJSON();
      const premiumPlan = item.premiumPlan;
      const profileData = {
        ...raw,
        userId: raw.userId || raw.User?.id || item.profile.userId,
        compatibilityScore: item.compatibilityScore,
        isPremium: !!premiumPlan,
        premiumPlan
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
