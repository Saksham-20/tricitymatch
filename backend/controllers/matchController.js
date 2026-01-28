const { Match, Profile, User, Subscription } = require('../models');
const { Op } = require('sequelize');
const { calculateCompatibility } = require('../utils/compatibility');
const { sendMatchNotification } = require('../utils/emailService');

// @route   POST /api/match/:userId
// @desc    Like/shortlist/pass a profile
// @access  Private
exports.matchAction = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'like', 'shortlist', or 'pass'
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({ message: 'Cannot match with yourself' });
    }

    if (!['like', 'shortlist', 'pass'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    // Check if match already exists
    let match = await Match.findOne({
      where: {
        userId: currentUserId,
        matchedUserId: userId
      }
    });

    // Calculate compatibility
    const currentProfile = await Profile.findOne({ where: { userId: currentUserId } });
    const matchedProfile = await Profile.findOne({ where: { userId } });
    
    let compatibilityScore = null;
    if (currentProfile && matchedProfile) {
      compatibilityScore = calculateCompatibility(currentProfile, matchedProfile);
    }

    if (match) {
      // Update existing match
      match.action = action;
      match.compatibilityScore = compatibilityScore;
      await match.save();
    } else {
      // Create new match
      match = await Match.create({
        userId: currentUserId,
        matchedUserId: userId,
        action,
        compatibilityScore
      });
    }

    // Check for mutual match
    if (action === 'like') {
      const reverseMatch = await Match.findOne({
        where: {
          userId,
          matchedUserId: currentUserId,
          action: 'like'
        }
      });

      if (reverseMatch) {
        // Mutual match!
        match.isMutual = true;
        match.mutualMatchDate = new Date();
        await match.save();

        reverseMatch.isMutual = true;
        reverseMatch.mutualMatchDate = new Date();
        await reverseMatch.save();

        // Send notifications
        const currentUser = await User.findByPk(currentUserId);
        const matchedUser = await User.findByPk(userId);
        
        if (currentUser && matchedUser) {
          const currentProfile = await Profile.findOne({ where: { userId: currentUserId } });
          const matchedProfile = await Profile.findOne({ where: { userId } });
          
          const profileUrl = `${process.env.FRONTEND_URL}/profile/${userId}`;
          const matchedProfileUrl = `${process.env.FRONTEND_URL}/profile/${currentUserId}`;
          
          await sendMatchNotification(
            matchedUser.email,
            `${currentProfile.firstName} ${currentProfile.lastName}`,
            profileUrl
          );
          
          await sendMatchNotification(
            currentUser.email,
            `${matchedProfile.firstName} ${matchedProfile.lastName}`,
            matchedProfileUrl
          );
        }
      }
    }

    res.json({
      success: true,
      match,
      isMutual: match.isMutual
    });
  } catch (error) {
    console.error('Match action error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/match/likes
// @desc    Get profiles that liked the current user (premium feature)
// @access  Private
exports.getLikes = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check subscription
    const subscription = await Subscription.findOne({
      where: {
        userId,
        status: 'active',
        planType: { [Op.in]: ['premium', 'elite'] }
      }
    });

    if (!subscription) {
      return res.status(403).json({ 
        message: 'Premium subscription required to view who liked you' 
      });
    }

    const likes = await Match.findAll({
      where: {
        matchedUserId: userId,
        action: 'like'
      },
      include: [
        {
          model: User,
          as: 'User',
          include: [{
            model: Profile,
            where: { isActive: true }
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      likes: likes.map(like => ({
        ...like.User.Profile.toJSON(),
        likedAt: like.createdAt,
        compatibilityScore: like.compatibilityScore
      }))
    });
  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/match/shortlist
// @desc    Get shortlisted profiles
// @access  Private
exports.getShortlist = async (req, res) => {
  try {
    const userId = req.user.id;

    const shortlisted = await Match.findAll({
      where: {
        userId,
        action: 'shortlist'
      },
      include: [
        {
          model: User,
          as: 'MatchedUser',
          include: [{
            model: Profile,
            where: { isActive: true }
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      shortlisted: shortlisted.map(match => ({
        ...match.MatchedUser.Profile.toJSON(),
        shortlistedAt: match.createdAt,
        compatibilityScore: match.compatibilityScore
      }))
    });
  } catch (error) {
    console.error('Get shortlist error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/match/mutual
// @desc    Get mutual matches
// @access  Private
exports.getMutualMatches = async (req, res) => {
  try {
    const userId = req.user.id;

    const mutualMatches = await Match.findAll({
      where: {
        userId,
        isMutual: true
      },
      include: [
        {
          model: User,
          as: 'MatchedUser',
          include: [{
            model: Profile,
            where: { isActive: true },
            required: false  // Allow matches even if Profile query fails
          }]
        }
      ],
      order: [['mutualMatchDate', 'DESC']]
    });

    // Filter out matches where Profile doesn't exist and map to expected format
    const validMatches = mutualMatches
      .filter(match => match.MatchedUser && match.MatchedUser.Profile)
      .map(match => {
        const profile = match.MatchedUser.Profile.toJSON();
        return {
          // Include userId from the matched user (not from Profile)
          userId: match.matchedUserId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          city: profile.city,
          profilePhoto: profile.profilePhoto,
          // Include additional fields that might be useful
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth,
          education: profile.education,
          profession: profile.profession,
          matchedAt: match.mutualMatchDate,
          compatibilityScore: match.compatibilityScore
        };
      });

    console.log(`Found ${validMatches.length} mutual matches for user ${userId}`);

    res.json({
      success: true,
      mutualMatches: validMatches
    });
  } catch (error) {
    console.error('Get mutual matches error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

