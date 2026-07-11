/**
 * Match Controller
 * Handles match actions (like/shortlist/pass) with proper transactions
 */

const { Match, Profile, User, Subscription, Block, Verification } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { PAID_PLANS } = require('../constants/plans');
const { calculateCompatibility } = require('../utils/compatibility');
const { getOrSet } = require('../utils/cache');
const { sendMatchNotification } = require('../utils/emailService');
const { notify } = require('../utils/notifyUser');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');

// @route   POST /api/match/:userId
// @desc    Like/shortlist/pass a profile
// @access  Private
exports.matchAction = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { action } = req.body;
  const currentUserId = req.user.id;

  // Prevent match actions between blocked users (either direction)
  const blockExists = await Block.findOne({
    where: {
      [Op.or]: [
        { blockerId: currentUserId, blockedUserId: userId },
        { blockerId: userId, blockedUserId: currentUserId }
      ]
    }
  });
  if (blockExists) {
    throw createError.forbidden('Cannot perform this action');
  }

  // Use transaction for consistency
  const result = await sequelize.transaction(async (t) => {
    // Check if match already exists
    let match = await Match.findOne({
      where: {
        userId: currentUserId,
        matchedUserId: userId
      },
      transaction: t
    });

    // Calculate compatibility
    const [currentProfile, matchedProfile] = await Promise.all([
      Profile.findOne({ where: { userId: currentUserId }, transaction: t }),
      Profile.findOne({ where: { userId }, transaction: t })
    ]);

    let compatibilityScore = null;
    if (currentProfile && matchedProfile) {
      compatibilityScore = calculateCompatibility(currentProfile, matchedProfile);
    }

    if (match) {
      // Update existing match
      match.action = action;
      match.compatibilityScore = compatibilityScore;
      await match.save({ transaction: t });
    } else {
      // Create new match
      match = await Match.create({
        userId: currentUserId,
        matchedUserId: userId,
        action,
        compatibilityScore
      }, { transaction: t });
    }

    // Check for mutual match
    let isMutualMatch = false;
    if (action === 'like') {
      const reverseMatch = await Match.findOne({
        where: {
          userId,
          matchedUserId: currentUserId,
          action: 'like'
        },
        transaction: t
      });

      if (reverseMatch) {
        // Mutual match! Update both records
        isMutualMatch = true;
        const mutualDate = new Date();

        match.isMutual = true;
        match.mutualMatchDate = mutualDate;
        await match.save({ transaction: t });

        reverseMatch.isMutual = true;
        reverseMatch.mutualMatchDate = mutualDate;
        await reverseMatch.save({ transaction: t });
      }
    }

    return { match, isMutualMatch, currentProfile, matchedProfile };
  });

  // Send notifications outside transaction (non-critical)
  setImmediate(async () => {
    try {
      const [currentUser, matchedUser] = await Promise.all([
        User.findByPk(currentUserId),
        User.findByPk(userId)
      ]);

      if (!currentUser || !matchedUser) return;

      const currentName = result.currentProfile
        ? `${result.currentProfile.firstName} ${result.currentProfile.lastName}`
        : 'Someone';
      const matchedName = result.matchedProfile
        ? `${result.matchedProfile.firstName} ${result.matchedProfile.lastName}`
        : 'Someone';

      if (result.isMutualMatch) {
        // Mutual match — notify both users in-app + email
        await Promise.all([
          notify(userId, 'new_match', "It's a Match!", `You and ${currentName} liked each other!`, result.match.id),
          notify(currentUserId, 'new_match', "It's a Match!", `You and ${matchedName} liked each other!`, result.match.id),
        ]);

        const profileUrl = `${config.server.frontendUrl}/profile/${userId}`;
        const matchedProfileUrl = `${config.server.frontendUrl}/profile/${currentUserId}`;
        Promise.all([
          sendMatchNotification(matchedUser.email, currentName, profileUrl),
          sendMatchNotification(currentUser.email, matchedName, matchedProfileUrl),
        ]).catch(err => log.error('Failed to send match emails', { error: err.message }));
      } else if (result.match.action === 'like') {
        // One-way like — notify the liked user in-app only (no email, avoid spam)
        await notify(userId, 'new_match', 'Someone liked your profile!', `${currentName} liked your profile. Like them back to connect!`, result.match.id);
      }
    } catch (error) {
      log.error('Error sending match notifications', { error: error.message, userId, currentUserId });
    }
  });

  res.json({
    success: true,
    match: result.match,
    isMutual: result.isMutualMatch
  });
});

// ---- Daily matches helpers ----
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_CACHE_SIZE = 15; // cache the top set; slice per tier on return

// IST calendar day key (YYYY-MM-DD) so the set rolls over at local midnight
const istDateKey = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
// Seconds until next IST midnight (cache TTL)
const secondsToNextISTMidnight = () => {
  const istNow = Date.now() + IST_OFFSET_MS;
  const sinceMidnight = istNow % DAY_MS;
  return Math.max(60, Math.ceil((DAY_MS - sinceMidnight) / 1000));
};

const premiumBoost = (plan) => (plan === 'vip' || plan === 'nri' ? 20 : plan === 'elite' ? 15 : plan === 'premium_plus' ? 10 : plan === 'basic_premium' ? 5 : 0);

// Compute the ranked daily set for a user (top DAILY_CACHE_SIZE). Pure read.
const computeDailyMatches = async (userId) => {
  const currentProfile = await Profile.findOne({ where: { userId } });
  if (!currentProfile) return [];

  const gender = (currentProfile.gender || '').toLowerCase();
  const genderFilter = gender === 'male'
    ? { gender: 'female' }
    : gender === 'female'
      ? { gender: 'male' }
      : { gender: { [Op.in]: ['male', 'female'] } };

  const [interacted, blocks] = await Promise.all([
    Match.findAll({ where: { userId }, attributes: ['matchedUserId'] }).then(rows => rows.map(r => r.matchedUserId)),
    Block.findAll({
      where: { [Op.or]: [{ blockerId: userId }, { blockedUserId: userId }] },
      attributes: ['blockerId', 'blockedUserId'],
    }),
  ]);
  const blockedIds = blocks.map(b => (b.blockerId === userId ? b.blockedUserId : b.blockerId));
  const excludedIds = [...new Set([...interacted, ...blockedIds])];

  const profiles = await Profile.findAll({
    where: {
      isActive: true,
      userId: { [Op.ne]: userId, [Op.notIn]: excludedIds },
      ...genderFilter,
    },
    include: [{ model: User, attributes: ['id', 'status', 'isBoosted', 'boostExpiresAt'], where: { status: 'active' } }],
    limit: DAILY_CACHE_SIZE * 4, // over-fetch, rank, then cap
  });

  const candidateIds = profiles.map(p => p.userId);
  const [subs, verifications] = await Promise.all([
    candidateIds.length
      ? Subscription.findAll({
          where: {
            userId: { [Op.in]: candidateIds },
            status: 'active',
            planType: { [Op.in]: PAID_PLANS },
            [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }],
          },
          attributes: ['userId', 'planType'],
        })
      : [],
    candidateIds.length
      ? Verification.findAll({ where: { userId: { [Op.in]: candidateIds }, status: 'approved' }, attributes: ['userId'] })
      : [],
  ]);

  const verifiedIds = new Set(verifications.map(v => v.userId));
  const planRank = { nri: 4, vip: 4, elite: 3, premium_plus: 2, basic_premium: 1 };
  const subMap = new Map();
  subs.forEach(s => {
    const cur = subMap.get(s.userId);
    if (!cur || (planRank[s.planType] || 0) > (planRank[cur] || 0)) subMap.set(s.userId, s.planType);
  });

  const now = new Date();
  const ranked = profiles
    .map(profile => {
      const isBoosted = profile.User?.isBoosted && (!profile.User?.boostExpiresAt || new Date(profile.User.boostExpiresAt) > now);
      const plan = subMap.get(profile.userId) || null;
      return {
        profile,
        plan,
        isBoosted,
        score: calculateCompatibility(currentProfile, profile) + premiumBoost(plan) + (isBoosted ? 8 : 0),
        compatibilityScore: calculateCompatibility(currentProfile, profile),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, DAILY_CACHE_SIZE)
    .map(item => {
      const raw = item.profile.toJSON();
      delete raw.User;
      return {
        ...raw,
        userId: raw.userId,
        compatibilityScore: item.compatibilityScore,
        isPremium: !!item.plan,
        premiumPlan: item.plan,
        isBoosted: item.isBoosted,
        isVerified: verifiedIds.has(raw.userId),
      };
    });

  return ranked;
};

// @route   GET /api/match/daily
// @desc    "Matches of the day" — same compatibility-ranked set per user per IST day
// @access  Private (free: 5, premium/vip: 15)
exports.getDailyMatches = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Viewer tier sets how many of the cached set they see
  const viewerSub = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      planType: { [Op.in]: PAID_PLANS },
      [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }],
    },
    attributes: ['planType'],
  });
  const isPremiumViewer = !!viewerSub;
  const visibleCount = isPremiumViewer ? 15 : 5;

  const cacheKey = `daily-matches:${userId}:${istDateKey()}`;
  // Cache the full ranked set once per IST day; recompute on Redis miss.
  const fullSet = await getOrSet(cacheKey, () => computeDailyMatches(userId), secondsToNextISTMidnight());

  res.json({
    success: true,
    matches: (fullSet || []).slice(0, visibleCount),
    isPremium: isPremiumViewer,
    totalAvailable: (fullSet || []).length,
    visibleCount,
    refreshesAt: 'next midnight IST',
  });
});

// @route   GET /api/match/likes
// @desc    Get profiles that liked the current user (premium feature)
// @access  Private/Premium
exports.getLikes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  // Get likes with pagination
  const { count, rows: likes } = await Match.findAndCountAll({
    where: {
      matchedUserId: userId,
      action: 'like'
    },
    include: [
      {
        model: User,
        as: 'User',
        attributes: ['id'],
        include: [{
          model: Profile,
          where: { isActive: true },
          attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'gender', 'dateOfBirth', 'education', 'profession']
        }]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  // Filter out likes without valid profiles
  const validLikes = likes
    .filter(like => like.User?.Profile)
    .map(like => ({
      userId: like.userId,
      ...like.User.Profile.toJSON(),
      likedAt: like.createdAt,
      compatibilityScore: like.compatibilityScore
    }));

  res.json({
    success: true,
    likes: validLikes,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   GET /api/match/shortlist
// @desc    Get shortlisted profiles
// @access  Private
exports.getShortlist = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: shortlisted } = await Match.findAndCountAll({
    where: {
      userId,
      action: 'shortlist'
    },
    include: [
      {
        model: User,
        as: 'MatchedUser',
        attributes: ['id'],
        include: [{
          model: Profile,
          where: { isActive: true },
          attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'gender', 'dateOfBirth', 'education', 'profession']
        }]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  const validShortlisted = shortlisted
    .filter(match => match.MatchedUser?.Profile)
    .map(match => ({
      userId: match.matchedUserId,
      ...match.MatchedUser.Profile.toJSON(),
      shortlistedAt: match.createdAt,
      compatibilityScore: match.compatibilityScore
    }));

  res.json({
    success: true,
    shortlisted: validShortlisted,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   GET /api/match/mutual
// @desc    Get mutual matches
// @access  Private
exports.getMutualMatches = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: mutualMatches } = await Match.findAndCountAll({
    where: {
      userId,
      isMutual: true
    },
    include: [
      {
        model: User,
        as: 'MatchedUser',
        attributes: ['id'],
        include: [{
          model: Profile,
          where: { isActive: true },
          required: false,
          attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'gender', 'dateOfBirth', 'education', 'profession']
        }]
      }
    ],
    order: [['mutualMatchDate', 'DESC']],
    limit,
    offset
  });

  const validMatches = mutualMatches
    .filter(match => match.MatchedUser?.Profile)
    .map(match => ({
      userId: match.matchedUserId,
      firstName: match.MatchedUser.Profile.firstName,
      lastName: match.MatchedUser.Profile.lastName,
      city: match.MatchedUser.Profile.city,
      profilePhoto: match.MatchedUser.Profile.profilePhoto,
      gender: match.MatchedUser.Profile.gender,
      dateOfBirth: match.MatchedUser.Profile.dateOfBirth,
      education: match.MatchedUser.Profile.education,
      profession: match.MatchedUser.Profile.profession,
      matchedAt: match.mutualMatchDate,
      compatibilityScore: match.compatibilityScore
    }));

  res.json({
    success: true,
    mutualMatches: validMatches,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});
