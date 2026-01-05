const { User, Profile, Subscription, Match, Verification, ProfileView } = require('../models');
const { Op } = require('sequelize');

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const { status, role, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
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
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   PUT /api/admin/users/:userId/status
// @desc    Update user status
// @access  Private/Admin
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'banned', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = status;
    await user.save();

    res.json({
      success: true,
      message: 'User status updated',
      user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/admin/verifications
// @desc    Get pending verifications
// @access  Private/Admin
exports.getVerifications = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   PUT /api/admin/verifications/:verificationId
// @desc    Approve/reject verification
// @access  Private/Admin
exports.updateVerification = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, adminNotes } = req.body;

    if (!['approved', 'rejected', 'flagged'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const verification = await Verification.findByPk(verificationId);
    if (!verification) {
      return res.status(404).json({ message: 'Verification not found' });
    }

    verification.status = status;
    verification.adminNotes = adminNotes;
    verification.verifiedAt = new Date();
    verification.verifiedBy = req.user.id;
    await verification.save();

    res.json({
      success: true,
      message: 'Verification updated',
      verification
    });
  } catch (error) {
    console.error('Update verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/admin/analytics
// @desc    Get analytics data
// @access  Private/Admin
exports.getAnalytics = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { status: 'active' } });
    const pendingUsers = await User.count({ where: { status: 'pending' } });
    const bannedUsers = await User.count({ where: { status: 'banned' } });

    // Subscription statistics
    const totalSubscriptions = await Subscription.count();
    const activeSubscriptions = await Subscription.count({ 
      where: { status: 'active' } 
    });
    const premiumSubscriptions = await Subscription.count({
      where: { status: 'active', planType: 'premium' }
    });
    const eliteSubscriptions = await Subscription.count({
      where: { status: 'active', planType: 'elite' }
    });

    // Revenue calculation
    const revenueData = await Subscription.findAll({
      where: { status: 'active' },
      attributes: ['planType', 'amount']
    });
    const totalRevenue = revenueData.reduce((sum, sub) => sum + (parseFloat(sub.amount) || 0), 0);

    // Match statistics
    const totalMatches = await Match.count();
    const mutualMatches = await Match.count({ where: { isMutual: true } });
    const totalLikes = await Match.count({ where: { action: 'like' } });

    // Profile views
    const totalProfileViews = await ProfileView.count();
    const viewsThisWeek = await ProfileView.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });

    // Verification statistics
    const pendingVerifications = await Verification.count({ 
      where: { status: 'pending' } 
    });
    const approvedVerifications = await Verification.count({ 
      where: { status: 'approved' } 
    });

    res.json({
      success: true,
      analytics: {
        users: {
          total: totalUsers,
          active: activeUsers,
          pending: pendingUsers,
          banned: bannedUsers
        },
        subscriptions: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          premium: premiumSubscriptions,
          elite: eliteSubscriptions,
          revenue: totalRevenue
        },
        matches: {
          total: totalMatches,
          mutual: mutualMatches,
          likes: totalLikes
        },
        engagement: {
          profileViews: totalProfileViews,
          viewsThisWeek: viewsThisWeek
        },
        verifications: {
          pending: pendingVerifications,
          approved: approvedVerifications
        }
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/admin/reports
// @desc    Get reported users/issues (placeholder for future implementation)
// @access  Private/Admin
exports.getReports = async (req, res) => {
  try {
    // This is a placeholder for a reports system
    // In a full implementation, you'd have a Reports model
    res.json({
      success: true,
      reports: [],
      message: 'Reports feature coming soon'
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

