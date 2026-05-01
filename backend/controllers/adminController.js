/**
 * Admin Controller
 * Administrative operations with proper authorization
 */

const { User, Profile, Subscription, Match, Verification, ProfileView, Report, ReferralCode, MarketingLead } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { logAudit } = require('../middlewares/logger');
const { generateInvoicePDF } = require('../utils/invoice');
const { notify } = require('../utils/notifyUser');
const { sendVerificationApproved, sendVerificationRejected } = require('../utils/email');

// Escape special characters for LIKE patterns
const escapeLikePattern = (str) => {
  if (!str) return str;
  return str.replace(/[%_\\]/g, '\\$&');
};

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100); // cap at 100 rows per page
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const { status, role, search } = req.query;
  const offset = (page - 1) * limit;

  const VALID_USER_STATUSES = ['active', 'inactive', 'banned', 'pending', 'deleted'];
  const VALID_USER_ROLES = ['user', 'admin', 'super_admin', 'marketing', 'marketing_manager'];

  const where = {};
  if (status && VALID_USER_STATUSES.includes(status)) where.status = status;
  if (role && VALID_USER_ROLES.includes(role)) where.role = role;
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
      // separate:true runs a dedicated query per user — required for limit+order on HasMany in findAndCountAll
      { model: Subscription, separate: true, order: [['createdAt', 'DESC']], limit: 1 }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    subQuery: false,
  });

  res.json({
    success: true,
    users,
    pagination: {
      page,
      limit,
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

  const validStatuses = ['active', 'inactive', 'banned', 'pending'];
  if (!status || !validStatuses.includes(status)) {
    throw createError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

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
  const rawStatus = req.query.status;
  const VALID_VERIFICATION_STATUSES = ['pending', 'approved', 'rejected'];
  const status = rawStatus && VALID_VERIFICATION_STATUSES.includes(rawStatus) ? rawStatus : 'pending';
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
  const offset = (page - 1) * limit;

  const { count, rows: verifications } = await Verification.findAndCountAll({
    where: { status },
    include: [
      {
        model: User,
        include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }]
      }
    ],
    order: [['createdAt', 'ASC']],
    limit,
    offset,
  });

  res.json({
    success: true,
    verifications,
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
  });
});

// @route   PUT /api/admin/verifications/:verificationId
// @desc    Approve/reject verification
// @access  Private/Admin
exports.updateVerification = asyncHandler(async (req, res) => {
  const { verificationId } = req.params;
  const { status, adminNotes } = req.body;

  // Allowlist status values
  const validVerificationStatuses = ['approved', 'rejected'];
  if (!status || !validVerificationStatuses.includes(status)) {
    throw createError.badRequest(`Status must be one of: ${validVerificationStatuses.join(', ')}`);
  }

  // Cap adminNotes length to prevent large payloads stored in DB
  const safeAdminNotes = typeof adminNotes === 'string'
    ? adminNotes.substring(0, 1000)
    : null;

  const verification = await Verification.findByPk(verificationId);
  if (!verification) {
    throw createError.notFound('Verification not found');
  }

  const previousStatus = verification.status;
  verification.status = status;
  verification.adminNotes = safeAdminNotes;
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

  // Notify user via in-app + email (non-blocking)
  setImmediate(async () => {
    try {
      const user = await User.findByPk(verification.userId, {
        attributes: ['email'],
        include: [{ model: Profile, attributes: ['firstName'] }]
      });
      if (!user) return;
      const name = user.Profile?.firstName || 'User';

      if (status === 'approved') {
        await notify(verification.userId, 'verification_approved', 'Profile Verified!', 'Your identity has been verified. Your profile now shows a verified badge.');
        await sendVerificationApproved(user.email, name);
      } else if (status === 'rejected') {
        const reason = safeAdminNotes || 'Please resubmit with clear, valid documents.';
        await notify(verification.userId, 'verification_rejected', 'Verification Update', `Your verification was not approved. ${reason}`);
        await sendVerificationRejected(user.email, name, reason);
      }
    } catch (err) {
      // Non-fatal — verification is already saved
    }
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
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalUsers,
    verifiedUsers,
    activeSubscribers,
    revenueThisMonth,
    pendingVerifications,
    openReports,
    registrations,
    monthlyRevenue,
    planDistribution,
  ] = await Promise.all([
    // Total non-admin users
    User.count({ where: { role: 'user' } }),

    // Email-verified users
    User.count({ where: { role: 'user', emailVerified: true } }),

    // Active premium subscribers
    Subscription.count({
      where: {
        status: 'active',
        planType: { [Op.in]: ['basic_premium', 'premium_plus', 'vip'] },
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: now } }],
      },
    }),

    // Revenue collected this calendar month
    Subscription.sum('amount', {
      where: { status: 'active', createdAt: { [Op.gte]: startOfMonth } },
    }),

    // Pending verification requests
    Verification.count({ where: { status: 'pending' } }),

    // Open (pending) user reports
    Report.count({ where: { status: 'pending' } }),

    // Daily registrations for last 30 days
    sequelize.query(
      `SELECT TO_CHAR("createdAt"::date, 'MM/DD') AS date, COUNT(*)::int AS count
       FROM "Users"
       WHERE "createdAt" >= :thirtyDaysAgo AND role = 'user'
       GROUP BY "createdAt"::date
       ORDER BY "createdAt"::date ASC`,
      { replacements: { thirtyDaysAgo }, type: sequelize.QueryTypes.SELECT }
    ),

    // Monthly revenue for last 6 months
    sequelize.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YY') AS month,
              SUM(amount)::float AS amount
       FROM "Subscriptions"
       WHERE "createdAt" >= :sixMonthsAgo AND status = 'active'
       GROUP BY DATE_TRUNC('month', "createdAt")
       ORDER BY DATE_TRUNC('month', "createdAt") ASC`,
      { replacements: { sixMonthsAgo }, type: sequelize.QueryTypes.SELECT }
    ),

    // Subscription plan distribution
    Subscription.findAll({
      where: { status: 'active' },
      attributes: [
        'planType',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
      ],
      group: ['planType'],
      raw: true,
    }),
  ]);

  res.json({
    success: true,
    stats: {
      totalUsers,
      verifiedUsers,
      activeSubscribers,
      revenueThisMonth: revenueThisMonth || 0,
      pendingVerifications,
      openReports,
    },
    registrations: registrations.map((r) => ({ date: r.date, count: r.count })),
    revenue: monthlyRevenue.map((r) => ({ month: r.month, amount: r.amount || 0 })),
    planDistribution: planDistribution.map((p) => ({ plan: p.planType, count: parseInt(p.count) })),
  });
});

// @route   GET /api/admin/reports
// @desc    Get user reports with optional status filter
// @access  Private/Admin
exports.getReports = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const { status } = req.query;
  const VALID_REPORT_STATUSES = ['pending', 'reviewed', 'dismissed'];
  const where = {};
  if (status && VALID_REPORT_STATUSES.includes(status)) where.status = status;

  const { count, rows: reports } = await Report.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'Reporter',
        attributes: ['id', 'email'],
        include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
      },
      {
        model: User,
        as: 'ReportedUser',
        attributes: ['id', 'email'],
        include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json({
    success: true,
    reports,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / parseInt(limit)),
    },
  });
});

// @route   PUT /api/admin/reports/:reportId
// @desc    Update report status (reviewed/dismissed)
// @access  Private/Admin
exports.updateReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { status, adminNotes } = req.body;

  const validStatuses = ['reviewed', 'dismissed'];
  if (!validStatuses.includes(status)) {
    throw createError.badRequest('Status must be reviewed or dismissed');
  }

  const report = await Report.findByPk(reportId);
  if (!report) throw createError.notFound('Report not found');

  const previous = report.status;
  report.status = status;
  report.adminNotes = adminNotes || null;
  report.reviewedBy = req.user.id;
  report.reviewedAt = new Date();
  await report.save();

  logAudit('report_status_changed', req.user.id, { reportId, previous, status });

  // Notify reporter that their report was reviewed
  await notify(
    report.reporterId,
    'report_reviewed',
    'Your report has been reviewed',
    `Your report has been ${status === 'reviewed' ? 'reviewed and action has been taken' : 'reviewed and dismissed'}.`
  );

  res.json({ success: true, report });
});

// @route   POST /api/admin/users
// @desc    Create a new user (admin-side)
// @access  Private/Admin
exports.createUser = asyncHandler(async (req, res) => {
  const { email, password, phone, firstName, lastName, status = 'active' } = req.body;
  // Role must always default to 'user' — never trust the request body for role assignment.
  // Admin can promote users via a separate, explicit admin action if needed.
  const role = 'user';

  if (!email || !password || !firstName || !lastName) {
    throw createError.badRequest('email, password, firstName, and lastName are required');
  }

  // Validate status to only allowed values (never allow 'banned' on creation)
  const allowedStatuses = ['active', 'pending', 'inactive'];
  const safeStatus = allowedStatuses.includes(status) ? status : 'active';

  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) throw createError.conflict('User already exists with this email');

  const result = await sequelize.transaction(async (t) => {
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      phone: phone || null,
      role,
      status: safeStatus,
      emailVerified: true,
    }, { transaction: t });

    await Profile.create({
      userId: user.id,
      firstName,
      lastName,
      gender: 'other',
      dateOfBirth: new Date('1990-01-01'),
    }, { transaction: t });

    return user;
  });

  logAudit('user_created_by_admin', req.user.id, { newUserId: result.id, email });

  const user = await User.findByPk(result.id, {
    include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city'] }],
    attributes: { exclude: ['password'] },
  });

  res.status(201).json({ success: true, message: 'User created', user });
});

// @route   GET /api/admin/users/:userId
// @desc    Get full user detail for admin
// @access  Private/Admin
exports.getUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password'] },
    include: [
      { model: Profile },
      { model: Verification },
    ],
  });

  if (user) {
    // Fetch subscriptions separately to avoid limit/order issues in eager load
    const subscriptions = await user.getSubscriptions
      ? await Subscription.findAll({ where: { userId }, order: [['createdAt', 'DESC']], limit: 10 })
      : [];
    user.dataValues.Subscriptions = subscriptions;
  }

  if (!user) throw createError.notFound('User not found');

  // Reports received by this user
  const reports = await Report.findAll({
    where: { reportedUserId: userId },
    limit: 10,
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'reason', 'status', 'createdAt'],
  });

  res.json({ success: true, user, reports });
});

// @route   PUT /api/admin/users/:userId/subscription
// @desc    Manually override a user's subscription (bypass Razorpay)
// @access  Private/Admin
exports.updateSubscription = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { planType, startDate, endDate, status = 'active' } = req.body;

  const validPlans = ['free', 'basic_premium', 'premium_plus', 'vip'];
  if (!validPlans.includes(planType)) {
    throw createError.badRequest('planType must be free, basic_premium, premium_plus, or vip');
  }

  const user = await User.findByPk(userId);
  if (!user) throw createError.notFound('User not found');

  // Cancel existing active subscriptions
  await Subscription.update(
    { status: 'cancelled' },
    { where: { userId, status: 'active' } }
  );

  const { getPlanDetails } = require('../utils/razorpay');
  const planDetails = getPlanDetails(planType);

  const subEndDate = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const subscription = await Subscription.create({
    userId,
    planType,
    status,
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: subEndDate,
    amount: planType === 'basic_premium' ? 1500 : planType === 'premium_plus' ? 3000 : planType === 'vip' ? 7499 : 0,
    contactUnlocksAllowed: planDetails ? planDetails.contactUnlocks : null,
    contactUnlocksUsed: 0,
  });

  // VIP admin override: activate profile boost
  if (planType === 'vip' && status === 'active') {
    await User.update(
      { isBoosted: true, boostExpiresAt: subEndDate },
      { where: { id: userId } }
    );
  }

  logAudit('subscription_overridden', req.user.id, { userId, planType, status });

  await notify(
    userId,
    'system',
    'Subscription updated',
    `Your subscription has been updated to ${planType} plan by the admin.`
  );

  res.json({ success: true, message: 'Subscription updated', subscription });
});

// @route   GET /api/admin/revenue
// @desc    Monthly revenue report
// @access  Private/Admin
exports.getRevenueReport = asyncHandler(async (req, res) => {
  const { format } = req.query; // ?format=csv

  // Monthly revenue for last 12 months
  const monthlyRevenue = await sequelize.query(
    `SELECT
       TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
       "planType",
       COUNT(*)::int AS count,
       SUM(amount)::float AS revenue
     FROM "Subscriptions"
     WHERE status IN ('active', 'expired')
       AND amount > 0
       AND "createdAt" >= NOW() - INTERVAL '12 months'
     GROUP BY DATE_TRUNC('month', "createdAt"), "planType"
     ORDER BY DATE_TRUNC('month', "createdAt") ASC`,
    { type: sequelize.constructor.QueryTypes.SELECT }
  );

  // All-time totals
  const [totals] = await sequelize.query(
    `SELECT
       COUNT(*)::int AS total_transactions,
       SUM(amount)::float AS total_revenue,
       AVG(amount)::float AS avg_transaction
     FROM "Subscriptions"
     WHERE status IN ('active', 'expired') AND amount > 0`,
    { type: sequelize.constructor.QueryTypes.SELECT }
  );

  if (format === 'csv') {
    // Sanitize CSV fields to prevent formula injection (prefix cells that start with =+-@)
    const csvSafe = (v) => {
      const s = String(v == null ? '' : v);
      return /^[=+\-@|]/.test(s) ? `'${s}` : s;
    };
    const rows = ['Month,Plan,Transactions,Revenue'];
    monthlyRevenue.forEach(r => {
      rows.push([csvSafe(r.month), csvSafe(r.planType), csvSafe(r.count), csvSafe(r.revenue)].join(','));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue-report.csv"');
    return res.send(rows.join('\n'));
  }

  res.json({
    success: true,
    monthlyRevenue,
    totals: {
      totalTransactions: totals?.total_transactions || 0,
      totalRevenue: totals?.total_revenue || 0,
      avgTransaction: totals?.avg_transaction || 0,
    },
  });
});

// @route   GET /api/admin/invoice/:subscriptionId
// @desc    Download invoice PDF (admin can access any user's invoice)
// @access  Private/Admin
exports.adminGetInvoice = asyncHandler(async (req, res) => {
  const { subscriptionId } = req.params;

  const subscription = await Subscription.findByPk(subscriptionId, {
    include: [{
      model: User,
      attributes: ['id', 'email'],
      include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
    }],
  });

  if (!subscription) throw createError.notFound('Subscription not found');

  generateInvoicePDF(res, {
    subscription,
    user: subscription.User,
    profile: subscription.User?.Profile,
  });
});

// ==================== MARKETING USERS ====================

// @route   GET /api/admin/marketing-users
// @desc    Get all marketing role users
// @access  Private/Admin
exports.getMarketingUsers = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const { status } = req.query;

  const VALID_MARKETING_STATUSES = ['active', 'inactive'];
  const where = { role: { [Op.in]: ['marketing', 'marketing_manager'] } };
  if (status && VALID_MARKETING_STATUSES.includes(status)) where.status = status;

  const { count, rows: users } = await User.findAndCountAll({
    where,
    include: [
      { model: Profile, attributes: ['firstName', 'lastName', 'city'] }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    users,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   POST /api/admin/marketing-users
// @desc    Create marketing user
// @access  Private/Admin
exports.createMarketingUser = asyncHandler(async (req, res) => {
  const { email, password, phone, firstName, lastName, role = 'marketing' } = req.body;

  if (!email || !password || !firstName || !lastName) {
    throw createError.badRequest('email, password, firstName, and lastName are required');
  }

  const validRoles = ['marketing', 'marketing_manager'];
  if (!validRoles.includes(role)) {
    throw createError.badRequest('role must be marketing or marketing_manager');
  }

  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) throw createError.conflict('User already exists with this email');

  const result = await sequelize.transaction(async (t) => {
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      phone: phone || null,
      role,
      status: 'active',
      emailVerified: true,
    }, { transaction: t });

    await Profile.create({
      userId: user.id,
      firstName,
      lastName,
      gender: 'other',
      dateOfBirth: new Date('1990-01-01'),
    }, { transaction: t });

    return user;
  });

  logAudit('marketing_user_created', req.user.id, { newUserId: result.id, email, role });

  const user = await User.findByPk(result.id, {
    include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
    attributes: { exclude: ['password'] },
  });

  res.status(201).json({ success: true, message: 'Marketing user created', user });
});

// @route   PUT /api/admin/marketing-users/:userId/status
// @desc    Activate/deactivate marketing user
// @access  Private/Admin
exports.updateMarketingUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  const validStatuses = ['active', 'inactive'];
  if (!validStatuses.includes(status)) {
    throw createError.badRequest('status must be active or inactive');
  }

  const user = await User.findByPk(userId);
  if (!user || !['marketing', 'marketing_manager'].includes(user.role)) {
    throw createError.notFound('Marketing user not found');
  }

  const previousStatus = user.status;
  user.status = status;
  await user.save();

  logAudit('marketing_user_status_changed', req.user.id, {
    targetUserId: userId,
    previousStatus,
    newStatus: status
  });

  res.json({ success: true, message: 'Marketing user status updated', user });
});

// @route   GET /api/admin/marketing-users/:userId/stats
// @desc    Get marketing user stats
// @access  Private/Admin
exports.getMarketingUserStats = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findByPk(userId);
  if (!user || !['marketing', 'marketing_manager'].includes(user.role)) {
    throw createError.notFound('Marketing user not found');
  }

  const [leadsCount, convertedCount, revenueData] = await Promise.all([
    MarketingLead.count({ where: { assignedToMarketingUserId: userId } }),
    MarketingLead.count({ where: { assignedToMarketingUserId: userId, status: 'converted' } }),
    sequelize.query(
      `SELECT SUM("amountPaid")::float AS total FROM "MarketingLeads" WHERE "assignedToMarketingUserId" = :userId AND "paymentStatus" = 'paid'`,
      { replacements: { userId }, type: sequelize.QueryTypes.SELECT }
    )
  ]);

  res.json({
    success: true,
    stats: {
      totalLeads: leadsCount,
      convertedLeads: convertedCount,
      totalRevenue: revenueData[0]?.total || 0
    }
  });
});

// ==================== REFERRAL CODES ====================

// @route   GET /api/admin/referral-codes
// @desc    Get all referral codes
// @access  Private/Admin
exports.getReferralCodes = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const { isActive } = req.query;

  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const { count, rows: codes } = await ReferralCode.findAndCountAll({
    where,
    include: [
      { model: User, as: 'MarketingUser', attributes: ['id', 'email'] }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    codes,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   POST /api/admin/referral-codes
// @desc    Create referral code
// @access  Private/Admin
exports.createReferralCode = asyncHandler(async (req, res) => {
  const { code, marketingUserId, campaign, source } = req.body;

  if (!code || !marketingUserId) {
    throw createError.badRequest('code and marketingUserId are required');
  }

  const user = await User.findByPk(marketingUserId);
  if (!user || !['marketing', 'marketing_manager'].includes(user.role)) {
    throw createError.badRequest('Invalid marketing user');
  }

  const existing = await ReferralCode.findOne({ where: { code } });
  if (existing) throw createError.conflict('Referral code already exists');

  const referralCode = await ReferralCode.create({
    code: code.toUpperCase(),
    marketingUserId,
    campaign: campaign || null,
    source: source || null,
    isActive: true,
    usageCount: 0
  });

  logAudit('referral_code_created', req.user.id, { codeId: referralCode.id, code });

  res.status(201).json({ success: true, message: 'Referral code created', referralCode });
});

// @route   PUT /api/admin/referral-codes/:id/toggle
// @desc    Activate/deactivate referral code
// @access  Private/Admin
exports.toggleReferralCode = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const code = await ReferralCode.findByPk(id);
  if (!code) throw createError.notFound('Referral code not found');

  code.isActive = !code.isActive;
  await code.save();

  logAudit('referral_code_toggled', req.user.id, { codeId: id, isActive: code.isActive });

  res.json({ success: true, message: 'Referral code updated', referralCode: code });
});

// ==================== MARKETING LEADS ====================

// @route   GET /api/admin/leads
// @desc    Get all marketing leads
// @access  Private/Admin
exports.getLeads = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const { status, paymentStatus, marketingUserId } = req.query;

  const VALID_LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];
  const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed'];

  const where = {};
  if (status && VALID_LEAD_STATUSES.includes(status)) where.status = status;
  if (paymentStatus && VALID_PAYMENT_STATUSES.includes(paymentStatus)) where.paymentStatus = paymentStatus;
  if (marketingUserId) where.assignedToMarketingUserId = marketingUserId;

  const { count, rows: leads } = await MarketingLead.findAndCountAll({
    where,
    include: [
      { model: User, as: 'AssignedMarketer', attributes: ['id', 'email'] },
      { model: User, as: 'ConvertedUser', attributes: ['id', 'email'] }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    leads,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

