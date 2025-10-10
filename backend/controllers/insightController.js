const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { User, Profile, ProfileView, Like, Shortlist, Chat, Notification } = require('../models');

// Get profile views (premium feature)
const getProfileViews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const profileViews = await ProfileView.findAndCountAll({
      where: { viewedUserId: userId },
      include: [
        {
          model: User,
          as: 'viewer',
          attributes: ['id', 'email', 'subscriptionType'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['name', 'photos', 'age', 'city', 'profession']
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        profileViews: profileViews.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(profileViews.count / limit),
          totalCount: profileViews.count,
          hasNext: offset + limit < profileViews.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get profile views error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile views'
    });
  }
};

// Get personal stats
const getPersonalStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '7d' } = req.query;

    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get profile views count
    const profileViews = await ProfileView.count({
      where: {
        viewedUserId: userId,
        createdAt: { [Op.gte]: startDate }
      }
    });

    // Get likes received count
    const likesReceived = await Like.count({
      where: {
        likedUserId: userId,
        createdAt: { [Op.gte]: startDate }
      }
    });

    // Get likes given count
    const likesGiven = await Like.count({
      where: {
        userId: userId,
        createdAt: { [Op.gte]: startDate }
      }
    });

    // Get shortlists count
    const shortlists = await Shortlist.count({
      where: {
        userId: userId,
        createdAt: { [Op.gte]: startDate }
      }
    });

    // Get messages sent count
    const messagesSent = await Chat.count({
      where: {
        senderId: userId,
        createdAt: { [Op.gte]: startDate }
      }
    });

    // Get messages received count
    const messagesReceived = await Chat.count({
      where: {
        receiverId: userId,
        createdAt: { [Op.gte]: startDate }
      }
    });

    // Get profile completion percentage
    const profile = await Profile.findOne({ where: { userId } });
    const completionPercentage = profile ? profile.profileCompletionPercentage : 0;

    // Get subscription status
    const user = await User.findByPk(userId);
    const isPremium = user.subscriptionType !== 'free' && user.isSubscriptionActive();

    res.json({
      success: true,
      data: {
        period,
        stats: {
          profileViews,
          likesReceived,
          likesGiven,
          shortlists,
          messagesSent,
          messagesReceived,
          completionPercentage,
          isPremium
        },
        insights: generateInsights({
          profileViews,
          likesReceived,
          likesGiven,
          shortlists,
          messagesSent,
          messagesReceived,
          completionPercentage,
          isPremium
        })
      }
    });

  } catch (error) {
    console.error('Get personal stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching personal stats'
    });
  }
};

// Get engagement insights
const getEngagementInsights = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { period = '30d', startDate, endDate } = req.query;

    // Calculate date range
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const start = new Date();
      start.setDate(start.getDate() - days);
      dateRange = {
        [Op.gte]: start
      };
    }

    // Get daily engagement data
    const dailyViews = await ProfileView.findAll({
      attributes: [
        [ProfileView.sequelize.fn('DATE', ProfileView.sequelize.col('createdAt')), 'date'],
        [ProfileView.sequelize.fn('COUNT', ProfileView.sequelize.col('id')), 'count']
      ],
      where: {
        viewedUserId: userId,
        createdAt: dateRange
      },
      group: [ProfileView.sequelize.fn('DATE', ProfileView.sequelize.col('createdAt'))],
      order: [[ProfileView.sequelize.fn('DATE', ProfileView.sequelize.col('createdAt')), 'ASC']]
    });

    const dailyLikes = await Like.findAll({
      attributes: [
        [Like.sequelize.fn('DATE', Like.sequelize.col('createdAt')), 'date'],
        [Like.sequelize.fn('COUNT', Like.sequelize.col('id')), 'count']
      ],
      where: {
        likedUserId: userId,
        createdAt: dateRange
      },
      group: [Like.sequelize.fn('DATE', Like.sequelize.col('createdAt'))],
      order: [[Like.sequelize.fn('DATE', Like.sequelize.col('createdAt')), 'ASC']]
    });

    // Get top cities that viewed your profile
    const topCities = await ProfileView.findAll({
      attributes: [
        [ProfileView.sequelize.col('viewer.profile.city'), 'city'],
        [ProfileView.sequelize.fn('COUNT', ProfileView.sequelize.col('ProfileView.id')), 'count']
      ],
      include: [
        {
          model: User,
          as: 'viewer',
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: []
            }
          ],
          attributes: []
        }
      ],
      where: {
        viewedUserId: userId,
        createdAt: dateRange
      },
      group: [ProfileView.sequelize.col('viewer.profile.city')],
      order: [[ProfileView.sequelize.fn('COUNT', ProfileView.sequelize.col('ProfileView.id')), 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        period,
        dailyViews,
        dailyLikes,
        topCities
      }
    });

  } catch (error) {
    console.error('Get engagement insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching engagement insights'
    });
  }
};

// Get compatibility insights
const getCompatibilityInsights = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { period = '30d' } = req.query;

    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get mutual likes (matches)
    const matches = await Like.findAll({
      where: {
        userId: userId,
        isMutual: true,
        createdAt: { [Op.gte]: startDate }
      },
      include: [
        {
          model: User,
          as: 'likedUser',
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['name', 'city', 'profession', 'religion', 'education']
            }
          ]
        }
      ]
    });

    // Analyze match patterns
    const cityDistribution = {};
    const professionDistribution = {};
    const religionDistribution = {};
    const educationDistribution = {};

    matches.forEach(match => {
      const profile = match.likedUser.profile;
      if (profile) {
        cityDistribution[profile.city] = (cityDistribution[profile.city] || 0) + 1;
        professionDistribution[profile.profession] = (professionDistribution[profile.profession] || 0) + 1;
        religionDistribution[profile.religion] = (religionDistribution[profile.religion] || 0) + 1;
        educationDistribution[profile.education] = (educationDistribution[profile.education] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        period,
        totalMatches: matches.length,
        matches: matches.map(match => ({
          id: match.id,
          name: match.likedUser.profile?.name,
          city: match.likedUser.profile?.city,
          profession: match.likedUser.profile?.profession,
          createdAt: match.createdAt
        })),
        patterns: {
          cityDistribution,
          professionDistribution,
          religionDistribution,
          educationDistribution
        }
      }
    });

  } catch (error) {
    console.error('Get compatibility insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching compatibility insights'
    });
  }
};

// Get profile performance
const getProfilePerformance = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get profile
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Get completion status
    const completionPercentage = profile.profileCompletionPercentage;
    const missingFields = getMissingFields(profile);

    // Get verification status
    const verificationStatus = profile.verificationStatus;

    // Get photo count
    const photoCount = profile.photos ? profile.photos.length : 0;

    // Get recent activity
    const recentViews = await ProfileView.count({
      where: {
        viewedUserId: userId,
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });

    const recentLikes = await Like.count({
      where: {
        likedUserId: userId,
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });

    // Generate recommendations
    const recommendations = generateRecommendations({
      completionPercentage,
      photoCount,
      verificationStatus,
      recentViews,
      recentLikes
    });

    res.json({
      success: true,
      data: {
        profile: {
          completionPercentage,
          verificationStatus,
          photoCount,
          missingFields
        },
        recentActivity: {
          views: recentViews,
          likes: recentLikes
        },
        recommendations
      }
    });

  } catch (error) {
    console.error('Get profile performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile performance'
    });
  }
};

// Helper function to generate insights
const generateInsights = (stats) => {
  const insights = [];

  if (stats.profileViews > 0) {
    insights.push({
      type: 'positive',
      message: `Great! ${stats.profileViews} people viewed your profile this ${stats.period === '7d' ? 'week' : 'month'}.`
    });
  } else {
    insights.push({
      type: 'suggestion',
      message: 'Complete your profile to get more views and better matches.'
    });
  }

  if (stats.likesReceived > 0) {
    insights.push({
      type: 'positive',
      message: `You received ${stats.likesReceived} likes! Someone is interested in you.`
    });
  }

  if (stats.completionPercentage < 80) {
    insights.push({
      type: 'warning',
      message: `Your profile is ${stats.completionPercentage}% complete. Complete it to get 3x more matches.`
    });
  }

  if (stats.photoCount === 0) {
    insights.push({
      type: 'suggestion',
      message: 'Add photos to your profile to get 5x more engagement.'
    });
  }

  if (!stats.isPremium && stats.profileViews > 5) {
    insights.push({
      type: 'upgrade',
      message: 'Upgrade to Premium to see who viewed your profile and unlock unlimited features.'
    });
  }

  return insights;
};

// Helper function to generate recommendations
const generateRecommendations = (data) => {
  const recommendations = [];

  if (data.completionPercentage < 80) {
    recommendations.push({
      priority: 'high',
      title: 'Complete Your Profile',
      description: 'Complete your profile to get better matches and more visibility.',
      action: 'Complete Profile'
    });
  }

  if (data.photoCount < 3) {
    recommendations.push({
      priority: 'high',
      title: 'Add More Photos',
      description: 'Add at least 3 photos to showcase your personality and get more engagement.',
      action: 'Add Photos'
    });
  }

  if (data.verificationStatus !== 'verified') {
    recommendations.push({
      priority: 'medium',
      title: 'Verify Your Identity',
      description: 'Get verified to build trust and get a verified badge on your profile.',
      action: 'Verify Identity'
    });
  }

  if (data.recentViews < 5) {
    recommendations.push({
      priority: 'medium',
      title: 'Boost Your Profile',
      description: 'Use profile boost to appear on top of search results and get more visibility.',
      action: 'Boost Profile'
    });
  }

  if (data.recentLikes === 0 && data.recentViews > 10) {
    recommendations.push({
      priority: 'low',
      title: 'Improve Your Profile',
      description: 'Your profile gets views but no likes. Consider updating your photos or bio.',
      action: 'Update Profile'
    });
  }

  return recommendations;
};

// Helper function to get missing fields
const getMissingFields = (profile) => {
  const requiredFields = [
    { key: 'name', label: 'Name' },
    { key: 'height', label: 'Height' },
    { key: 'religion', label: 'Religion' },
    { key: 'education', label: 'Education' },
    { key: 'profession', label: 'Profession' },
    { key: 'city', label: 'City' },
    { key: 'bio', label: 'About You' },
    { key: 'photos', label: 'Photos' }
  ];

  return requiredFields.filter(field => {
    const value = profile[field.key];
    return !value || (Array.isArray(value) && value.length === 0);
  }).map(field => field.label);
};

module.exports = {
  getProfileViews,
  getPersonalStats,
  getEngagementInsights,
  getCompatibilityInsights,
  getProfilePerformance
};
