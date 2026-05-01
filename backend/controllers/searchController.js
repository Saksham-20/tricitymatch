/**
 * Search Controller
 * Handles profile search with optimized queries
 */

const { Profile, User, Match, Subscription, Block, Verification } = require('../models');
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
    religion,
    caste,
    maritalStatus,
    incomeMin,
    incomeMax,
    motherTongue,
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

  // Fetch blocked/blocking user IDs to exclude from results
  const blocks = await Block.findAll({
    where: {
      [Op.or]: [{ blockerId: userId }, { blockedUserId: userId }]
    },
    attributes: ['blockerId', 'blockedUserId']
  });
  const blockedUserIds = blocks.map(b => b.blockerId === userId ? b.blockedUserId : b.blockerId);

  // Build where clause
  const where = {
    isActive: true,
    incognitoMode: { [Op.ne]: true }, // Exclude users in incognito mode
    userId: {
      [Op.ne]: userId, // Exclude self
      ...(blockedUserIds.length > 0 ? { [Op.notIn]: blockedUserIds } : {})
    }
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

  // Religion filter
  if (religion) {
    where.religion = { [Op.iLike]: escapeLikePattern(religion) };
  }

  // Caste filter
  if (caste) {
    where.caste = { [Op.iLike]: `%${escapeLikePattern(caste)}%` };
  }

  // Marital status filter
  const validMaritalStatuses = ['never_married', 'divorced', 'widowed', 'awaiting_divorce'];
  if (maritalStatus && validMaritalStatuses.includes(maritalStatus)) {
    where.maritalStatus = maritalStatus;
  }

  // Income filter — parse and validate to prevent NaN being passed to the DB query
  const parsedIncomeMin = incomeMin !== undefined ? parseInt(incomeMin, 10) : NaN;
  const parsedIncomeMax = incomeMax !== undefined ? parseInt(incomeMax, 10) : NaN;
  if (!isNaN(parsedIncomeMin) && parsedIncomeMin >= 0) {
    where.income = { ...(where.income || {}), [Op.gte]: parsedIncomeMin };
  }
  if (!isNaN(parsedIncomeMax) && parsedIncomeMax >= 0) {
    where.income = { ...(where.income || {}), [Op.lte]: parsedIncomeMax };
  }

  // Mother tongue filter
  if (motherTongue) {
    where.motherTongue = { [Op.iLike]: escapeLikePattern(motherTongue) };
  }

  // Get profiles — include isBoosted + boostExpiresAt for ranking
  const profiles = await Profile.findAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'status', 'isBoosted', 'boostExpiresAt'],
        where: { status: 'active' }
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  // Batch query for match statuses (fixes N+1)
  const profileUserIds = profiles.map(p => p.userId);
  const [existingMatches, activeSubscriptions, verifications] = await Promise.all([
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
      : [],
    profileUserIds.length > 0
      ? Verification.findAll({
        where: {
          userId: { [Op.in]: profileUserIds },
          status: 'approved'
        },
        attributes: ['userId']
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

  // Verified user IDs set
  const verifiedUserIds = new Set(verifications.map(v => v.userId));

  const now = new Date();

  // Calculate compatibility for each profile
  const profilesWithCompatibility = profiles.map((profile) => {
    const compatibilityScore = calculateCompatibility(currentProfile, profile);
    const match = matchMap.get(profile.userId);
    const premiumPlan = subMap.get(profile.userId) || null;
    // Check if referral boost is still active
    const isBoostedActive = profile.User?.isBoosted &&
      (!profile.User?.boostExpiresAt || new Date(profile.User.boostExpiresAt) > now);

    const raw = profile.toJSON();
    const isMutual = match ? match.isMutual : false;

    // Enforce photo blur: hide photos for non-mutual matches when user has photoBlurUntilMatch
    const profilePhoto = (raw.photoBlurUntilMatch && !isMutual) ? null : raw.profilePhoto;
    const photos = (raw.photoBlurUntilMatch && !isMutual) ? [] : raw.photos;

    const profileData = {
      ...raw,
      profilePhoto,
      photos,
      userId: raw.userId || raw.User?.id || profile.userId,
      compatibilityScore,
      matchStatus: match ? match.action : null,
      isMutual,
      isBoosted: isBoostedActive,
      isPremium: !!premiumPlan,
      premiumPlan,
      isVerified: verifiedUserIds.has(raw.userId || profile.userId)
    };

    // Remove nested User object
    if (profileData.User) {
      delete profileData.User;
    }

    return profileData;
  });

  // Boost premium members and referral-boosted users toward top
  const premiumBoost = (plan) => {
    if (plan === 'vip') return 20;
    if (plan === 'premium_plus') return 10;
    if (plan === 'basic_premium') return 5;
    return 0;
  };

  // Sort by compatibility if requested
  if (sortBy === 'compatibility') {
    profilesWithCompatibility.sort((a, b) => {
      const scoreA = (a.compatibilityScore || 0) + premiumBoost(a.premiumPlan) + (a.isBoosted ? 8 : 0);
      const scoreB = (b.compatibilityScore || 0) + premiumBoost(b.premiumPlan) + (b.isBoosted ? 8 : 0);
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

  // Get profiles user hasn't interacted with, excluding blocked users
  const [interactedUserIds, suggestionBlocks] = await Promise.all([
    Match.findAll({ where: { userId }, attributes: ['matchedUserId'] })
      .then(matches => matches.map(m => m.matchedUserId)),
    Block.findAll({
      where: { [Op.or]: [{ blockerId: userId }, { blockedUserId: userId }] },
      attributes: ['blockerId', 'blockedUserId']
    })
  ]);
  const blockedSuggestionIds = suggestionBlocks.map(b => b.blockerId === userId ? b.blockedUserId : b.blockerId);
  const excludedIds = [...new Set([...interactedUserIds, ...blockedSuggestionIds])];

  const profiles = await Profile.findAll({
    where: {
      isActive: true,
      userId: { [Op.ne]: userId, [Op.notIn]: excludedIds },
      ...genderFilter
    },
    include: [
      {
        model: User,
        attributes: ['id', 'status', 'isBoosted', 'boostExpiresAt'],
        where: { status: 'active' }
      }
    ],
    limit: limit * 2 // Get more to filter by compatibility
  });

  // Batch-fetch active subscriptions + verifications for suggestion profiles
  const suggestionUserIds = profiles.map(p => p.userId);
  const [suggestionSubs, suggestionVerifications] = await Promise.all([
    suggestionUserIds.length > 0
      ? Subscription.findAll({
        where: {
          userId: { [Op.in]: suggestionUserIds },
          status: 'active',
          planType: { [Op.in]: ['basic_premium', 'premium_plus', 'vip'] },
          [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
        },
        attributes: ['userId', 'planType']
      })
      : [],
    suggestionUserIds.length > 0
      ? Verification.findAll({
        where: { userId: { [Op.in]: suggestionUserIds }, status: 'approved' },
        attributes: ['userId']
      })
      : []
  ]);

  const verifiedSuggestionIds = new Set(suggestionVerifications.map(v => v.userId));

  const planRankSug = { vip: 3, premium_plus: 2, basic_premium: 1 };
  const subMapSug = new Map();
  suggestionSubs.forEach(s => {
    const existing = subMapSug.get(s.userId);
    if (!existing || (planRankSug[s.planType] || 0) > (planRankSug[existing] || 0)) {
      subMapSug.set(s.userId, s.planType);
    }
  });

  const nowSug = new Date();

  // Calculate compatibility and sort (with premium + referral boost)
  const premiumBoostSug = (plan) => {
    if (plan === 'vip') return 20;
    if (plan === 'premium_plus') return 10;
    if (plan === 'basic_premium') return 5;
    return 0;
  };

  const profilesWithCompatibility = profiles.map(profile => {
    const isBoostedActive = profile.User?.isBoosted &&
      (!profile.User?.boostExpiresAt || new Date(profile.User.boostExpiresAt) > nowSug);
    return {
      profile,
      compatibilityScore: calculateCompatibility(currentProfile, profile),
      premiumPlan: subMapSug.get(profile.userId) || null,
      isBoosted: isBoostedActive,
    };
  });

  profilesWithCompatibility.sort((a, b) => {
    const scoreA = a.compatibilityScore + premiumBoostSug(a.premiumPlan) + (a.isBoosted ? 8 : 0);
    const scoreB = b.compatibilityScore + premiumBoostSug(b.premiumPlan) + (b.isBoosted ? 8 : 0);
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
        premiumPlan,
        isBoosted: item.isBoosted,
        isVerified: verifiedSuggestionIds.has(raw.userId || item.profile.userId),
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
