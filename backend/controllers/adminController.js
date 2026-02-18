/**
 * Admin Controller
 * Administrative operations with proper authorization
 */

const { User, Profile, Subscription, Match, Verification, ProfileView } = require('../models');
const { Op } = require('sequelize');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { logAudit } = require('../middlewares/logger');

// Escape special characters for LIKE patterns
const escapeLikePattern = (str) => {
  if (!str) return str;
  return str.replace(/[%_\\]/g, '\\$&');
};

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res) => {
  const { status, role, page = 1, limit = 20, search } = req.query;
  const offset = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (role) where.role = role;
  if (search) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${escapeLikePattern(search)}%` } },
      { phone: { [Op.iLike]: `%${escapeLikePattern(search)}%` } }
    ];
  }

  const { count, rows: users } = await User.findAndCountAll({
    where,
    include: [
      { model: Profile, attributes: ['firstName', 'lastName', 'city'] },
      { model: Subscription, order: [['createdAt', 'DESC']], limit: 1 }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   PUT /api/admin/users/:userId/status
// @desc    Update user status
// @access  Private/Admin
exports.updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  const user = await User.findByPk(userId);
  if (!user) {
    throw createError.notFound('User not found');
  }

  const previousStatus = user.status;
  user.status = status;
  await user.save();

  // Audit log
  logAudit('user_status_changed', req.user.id, {
    targetUserId: userId,
    previousStatus,
    newStatus: status
  });

  res.json({
    success: true,
    message: 'User status updated',
    user
  });
});

// @route   GET /api/admin/verifications
// @desc    Get pending verifications
// @access  Private/Admin
exports.getVerifications = asyncHandler(async (req, res) => {
  const { status = 'pending' } = req.query;

  const verifications = await Verification.findAll({
    where: { status },
    include: [
      {
        model: User,
        include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }]
      }
    ],
    order: [['createdAt', 'ASC']]
  });

  res.json({
    success: true,
    verifications
  });
});

// @route   PUT /api/admin/verifications/:verificationId
// @desc    Approve/reject verification
// @access  Private/Admin
exports.updateVerification = asyncHandler(async (req, res) => {
  const { verificationId } = req.params;
  const { status, adminNotes } = req.body;

  const verification = await Verification.findByPk(verificationId);
  if (!verification) {
    throw createError.notFound('Verification not found');
  }

  const previousStatus = verification.status;
  verification.status = status;
  verification.adminNotes = adminNotes;
  verification.verifiedAt = new Date();
  verification.verifiedBy = req.user.id;
  await verification.save();

  // Audit log
  logAudit('verification_status_changed', req.user.id, {
    verificationId,
    userId: verification.userId,
    previousStatus,
    newStatus: status
  });

  res.json({
    success: true,
    message: 'Verification updated',
    verification
  });
});

// @route   GET /api/admin/analytics
// @desc    Get analytics data
// @access  Private/Admin
exports.getAnalytics = asyncHandler(async (req, res) => {
  // Run all analytics queries in parallel
  const [
    userStats,
    subscriptionStats,
    matchStats,
    viewsThisWeek,
    verificationStats
  ] = await Promise.all([
    // User statistics
    User.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    }),

    // Subscription statistics with revenue
    Subscription.findAll({
      where: { status: 'active' },
      attributes: [
        'planType',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'revenue']
      ],
      group: ['planType'],
      raw: true
    }),

    // Match statistics
    Match.findAll({
      attributes: [
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
        [require('sequelize').fn('COUNT', require('sequelize').literal("CASE WHEN \"isMutual\" = true THEN 1 END")), 'mutual'],
        [require('sequelize').fn('COUNT', require('sequelize').literal("CASE WHEN \"action\" = 'like' THEN 1 END")), 'likes']
      ],
      raw: true
    }),

    // Profile views this week
    ProfileView.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    }),

    // Verification statistics
    Verification.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    })
  ]);

  // Process user stats
  const users = {
    total: 0,
    active: 0,
    pending: 0,
    banned: 0,
    inactive: 0
  };
  userStats.forEach(stat => {
    users[stat.status] = parseInt(stat.count);
    users.total += parseInt(stat.count);
  });

  // Process subscription stats
  const subscriptions = {
    total: 0,
    premium: 0,
    elite: 0,
    revenue: 0
  };
  subscriptionStats.forEach(stat => {
    subscriptions[stat.planType] = parseInt(stat.count);
    subscriptions.total += parseInt(stat.count);
    subscriptions.revenue += parseFloat(stat.revenue) || 0;
  });

  // Process match stats
  const matches = matchStats[0] ? {
    total: parseInt(matchStats[0].total) || 0,
    mutual: parseInt(matchStats[0].mutual) || 0,
    likes: parseInt(matchStats[0].likes) || 0
  } : { total: 0, mutual: 0, likes: 0 };

  // Process verification stats
  const verifications = {
    pending: 0,
    approved: 0,
    rejected: 0
  };
  verificationStats.forEach(stat => {
    verifications[stat.status] = parseInt(stat.count);
  });

  res.json({
    success: true,
    analytics: {
      users,
      subscriptions,
      matches,
      engagement: {
        viewsThisWeek,
        totalProfileViews: await ProfileView.count()
      },
      verifications
    }
  });
});

// @route   GET /api/admin/reports
// @desc    Get reported users/issues
// @access  Private/Admin
exports.getReports = asyncHandler(async (req, res) => {
  // Placeholder for reports system
  res.json({
    success: true,
    reports: [],
    message: 'Reports feature coming soon'
  });
});
