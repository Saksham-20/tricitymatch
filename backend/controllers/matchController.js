/**
 * Match Controller
 * Handles match actions (like/shortlist/pass) with proper transactions
 */

const { Match, Profile, User, Subscription } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { calculateCompatibility } = require('../utils/compatibility');
const { sendMatchNotification } = require('../utils/emailService');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');

// @route   POST /api/match/:userId
// @desc    Like/shortlist/pass a profile
// @access  Private
exports.matchAction = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { action } = req.body;
  const currentUserId = req.user.id;

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
  if (result.isMutualMatch) {
    try {
      const [currentUser, matchedUser] = await Promise.all([
        User.findByPk(currentUserId),
        User.findByPk(userId)
      ]);

      if (currentUser && matchedUser && result.currentProfile && result.matchedProfile) {
        const profileUrl = `${config.server.frontendUrl}/profile/${userId}`;
        const matchedProfileUrl = `${config.server.frontendUrl}/profile/${currentUserId}`;

        // Send emails in parallel (fire and forget)
        Promise.all([
          sendMatchNotification(
            matchedUser.email,
            `${result.currentProfile.firstName} ${result.currentProfile.lastName}`,
            profileUrl
          ),
          sendMatchNotification(
            currentUser.email,
            `${result.matchedProfile.firstName} ${result.matchedProfile.lastName}`,
            matchedProfileUrl
          )
        ]).catch(err => console.error('Failed to send match notifications:', err));
      }
    } catch (error) {
      console.error('Error preparing match notifications:', error);
    }
  }

  res.json({
    success: true,
    match: result.match,
    isMutual: result.isMutualMatch
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
