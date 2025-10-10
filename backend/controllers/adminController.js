const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { User, Profile, Payment, Report, Notification, ProfileView, Like, Shortlist } = require('../models');
const { sendEmail } = require('../utils/emailService');

// Get all users with filters
const getUsers = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      role,
      subscriptionType,
      isActive,
      isVerified
    } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (role) whereClause.role = role;
    if (subscriptionType) whereClause.subscriptionType = subscriptionType;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';

    // Build profile where clause for search and verification
    const profileWhereClause = {};
    if (search) {
      profileWhereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
        { profession: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (isVerified !== undefined) {
      profileWhereClause.verificationStatus = isVerified === 'true' ? 'verified' : { [Op.ne]: 'verified' };
    }

    const users = await User.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Profile,
          as: 'profile',
          where: Object.keys(profileWhereClause).length > 0 ? profileWhereClause : undefined,
          required: Object.keys(profileWhereClause).length > 0
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(users.count / limit),
          totalCount: users.count,
          hasNext: offset + limit < users.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [
        { model: Profile, as: 'profile' },
        { model: Payment, as: 'payments', order: [['createdAt', 'DESC']] },
        { model: Report, as: 'reportsMade', limit: 5 },
        { model: Report, as: 'reportsReceived', limit: 5 }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get additional stats
    const profileViews = await ProfileView.count({ where: { viewedUserId: id } });
    const likesReceived = await Like.count({ where: { likedUserId: id } });
    const likesGiven = await Like.count({ where: { userId: id } });

    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        stats: {
          profileViews,
          likesReceived,
          likesGiven
        }
      }
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user'
    });
  }
};

// Verify user identity
const verifyUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body; // status: 'verified' or 'rejected'

    const user = await User.findByPk(id, {
      include: [{ model: Profile, as: 'profile' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.profile) {
      return res.status(400).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Update verification status
    await user.profile.update({
      verificationStatus: status,
      verificationNotes: notes
    });

    // Create notification for user
    await Notification.create({
      userId: id,
      type: status === 'verified' ? 'verification_approved' : 'verification_rejected',
      title: status === 'verified' ? 'Identity Verified! ✅' : 'Verification Rejected',
      content: status === 'verified' 
        ? 'Congratulations! Your identity has been verified. You now have a verified badge on your profile.'
        : 'Your identity verification was rejected. Please check the requirements and try again.',
      data: { notes }
    });

    res.json({
      success: true,
      message: `User verification ${status} successfully`,
      data: {
        verificationStatus: status,
        notes
      }
    });

  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying user'
    });
  }
};

// Ban user
const banUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { reason, duration } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot ban admin users'
      });
    }

    // Calculate ban expiry
    const banExpiry = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;

    await user.update({
      isActive: false,
      banReason: reason,
      banExpiry,
      bannedBy: req.user.id,
      bannedAt: new Date()
    });

    // Create notification for user
    await Notification.create({
      userId: id,
      type: 'admin_message',
      title: 'Account Suspended',
      content: `Your account has been suspended. Reason: ${reason}${banExpiry ? `. Duration: ${duration} days` : ''}`,
      data: { reason, duration, banExpiry }
    });

    res.json({
      success: true,
      message: 'User banned successfully',
      data: {
        banReason: reason,
        banExpiry,
        duration
      }
    });

  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while banning user'
    });
  }
};

// Unban user
const unbanUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({
      isActive: true,
      banReason: null,
      banExpiry: null,
      bannedBy: null,
      bannedAt: null
    });

    // Create notification for user
    await Notification.create({
      userId: id,
      type: 'admin_message',
      title: 'Account Restored',
      content: 'Your account has been restored and you can now access all features.',
      data: {}
    });

    res.json({
      success: true,
      message: 'User unbanned successfully'
    });

  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while unbanning user'
    });
  }
};

// Get reports
const getReports = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      reason
    } = req.query;

    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (reason) whereClause.reason = reason;

    const reports = await Report.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'reporter',
          attributes: ['id', 'email'],
          include: [{ model: Profile, as: 'profile', attributes: ['name'] }]
        },
        {
          model: User,
          as: 'reportedUser',
          attributes: ['id', 'email'],
          include: [{ model: Profile, as: 'profile', attributes: ['name'] }]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        reports: reports.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(reports.count / limit),
          totalCount: reports.count,
          hasNext: offset + limit < reports.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reports'
    });
  }
};

// Resolve report
const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'ban_user', 'dismiss', 'warn_user'

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Update report status
    await report.update({
      status: 'resolved',
      adminNotes: notes,
      resolvedBy: req.user.id,
      resolvedAt: new Date()
    });

    // Take action based on report
    if (action === 'ban_user') {
      const reportedUser = await User.findByPk(report.reportedUserId);
      if (reportedUser && reportedUser.role !== 'admin') {
        await reportedUser.update({
          isActive: false,
          banReason: `Reported for: ${report.reason}`,
          bannedBy: req.user.id,
          bannedAt: new Date()
        });
      }
    }

    res.json({
      success: true,
      message: 'Report resolved successfully',
      data: {
        action,
        notes
      }
    });

  } catch (error) {
    console.error('Resolve report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resolving report'
    });
  }
};

// Dismiss report
const dismissReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    await report.update({
      status: 'dismissed',
      adminNotes: notes,
      resolvedBy: req.user.id,
      resolvedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Report dismissed successfully'
    });

  } catch (error) {
    console.error('Dismiss report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while dismissing report'
    });
  }
};

// Get analytics
const getAnalytics = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { period = '30d', startDate, endDate } = req.query;

    // Calculate date range
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const start = new Date();
      start.setDate(start.getDate() - days);
      dateRange = {
        [Op.gte]: start
      };
    }

    // Get user statistics
    const totalUsers = await User.count();
    const newUsers = await User.count({ where: { createdAt: dateRange } });
    const activeUsers = await User.count({ where: { isActive: true } });
    const verifiedUsers = await User.count({
      include: [{
        model: Profile,
        as: 'profile',
        where: { verificationStatus: 'verified' }
      }]
    });

    // Get subscription statistics
    const subscriptionStats = await User.findAll({
      attributes: [
        'subscriptionType',
        [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
      ],
      group: ['subscriptionType']
    });

    // Get revenue statistics
    const revenue = await Payment.sum('amount', {
      where: {
        status: 'completed',
        createdAt: dateRange
      }
    });

    // Get engagement statistics
    const totalLikes = await Like.count({ where: { createdAt: dateRange } });
    const totalProfileViews = await ProfileView.count({ where: { createdAt: dateRange } });
    const totalReports = await Report.count({ where: { createdAt: dateRange } });

    // Get daily signups for chart
    const dailySignups = await User.findAll({
      attributes: [
        [User.sequelize.fn('DATE', User.sequelize.col('createdAt')), 'date'],
        [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
      ],
      where: { createdAt: dateRange },
      group: [User.sequelize.fn('DATE', User.sequelize.col('createdAt'))],
      order: [[User.sequelize.fn('DATE', User.sequelize.col('createdAt')), 'ASC']]
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          new: newUsers,
          active: activeUsers,
          verified: verifiedUsers
        },
        subscriptions: subscriptionStats,
        revenue: {
          total: revenue || 0,
          inRupees: (revenue || 0) / 100
        },
        engagement: {
          likes: totalLikes,
          profileViews: totalProfileViews,
          reports: totalReports
        },
        dailySignups
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics'
    });
  }
};

// Get dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    // Get quick stats
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const premiumUsers = await User.count({ where: { subscriptionType: { [Op.ne]: 'free' } } });
    const pendingReports = await Report.count({ where: { status: 'pending' } });
    const pendingVerifications = await Profile.count({ where: { verificationStatus: 'pending' } });

    // Get recent activity
    const recentUsers = await User.findAll({
      include: [{ model: Profile, as: 'profile' }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    const recentReports = await Report.findAll({
      include: [
        { model: User, as: 'reporter', include: [{ model: Profile, as: 'profile' }] },
        { model: User, as: 'reportedUser', include: [{ model: Profile, as: 'profile' }] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          premiumUsers,
          pendingReports,
          pendingVerifications
        },
        recentActivity: {
          users: recentUsers,
          reports: recentReports
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard stats'
    });
  }
};

// Send notification to user
const sendNotificationToUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId, title, content, type = 'admin_message' } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create notification
    const notification = await Notification.create({
      userId,
      type,
      title,
      content,
      data: { sentBy: req.user.id }
    });

    res.json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        notification: notification.toJSON()
      }
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending notification'
    });
  }
};

// Get verification queue
const getVerificationQueue = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const profiles = await Profile.findAndCountAll({
      where: { verificationStatus: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'createdAt']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        profiles: profiles.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(profiles.count / limit),
          totalCount: profiles.count,
          hasNext: offset + limit < profiles.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get verification queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching verification queue'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  verifyUser,
  banUser,
  unbanUser,
  getReports,
  resolveReport,
  dismissReport,
  getAnalytics,
  getDashboardStats,
  sendNotificationToUser,
  getVerificationQueue
};
