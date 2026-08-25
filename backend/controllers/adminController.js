/**
 * Admin Controller
 * Administrative operations with proper authorization
 */

const { User, Profile, Subscription, Match, Verification, ProfileView, Report, ReferralCode, MarketingLead, SuccessStory, ContactMessage } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { PAID_PLANS, ALL_PLANS, UNLIMITED_PLANS, FOUNDING_PLAN, FOUNDING_CONTACT_UNLOCKS } = require('../constants/plans');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');
const { generateInvoicePDF } = require('../utils/invoice');
const { notify } = require('../utils/notifyUser');
const { sendVerificationApproved, sendVerificationRejected, sendSupportReply } = require('../utils/email');
const {
  ADMIN_SCOPES,
  ALL_SCOPES,
  DEFAULT_SUB_ADMIN_SCOPES,
  ADMIN_ROLES,
  FULL_ACCESS_ROLES,
  scopesFor,
  sanitizeScopes,
} = require('../constants/adminScopes');

/**
 * Attach the LIVE plan to a page of users.
 *
 * The list include can only cheaply carry "the most recent subscription row",
 * which is routinely a `pending` order nobody paid or a `cancelled` row left
 * by an override — so a client that read it showed the wrong plan. The panel
 * must agree with every entitlement gate, so the same predicate as
 * utils/entitlements.getActiveSubscription decides: status active, a paid
 * tier, and an endDate that has not passed.
 */
const attachActivePlans = async (users) => {
  if (!users.length) return users;
  const active = await Subscription.findAll({
    where: {
      userId: { [Op.in]: users.map((u) => u.id) },
      status: 'active',
      planType: { [Op.in]: PAID_PLANS },
      [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }],
    },
    order: [['createdAt', 'DESC']],
  });
  const byUser = new Map();
  for (const sub of active) if (!byUser.has(sub.userId)) byUser.set(sub.userId, sub);
  for (const user of users) {
    const sub = byUser.get(user.id) || null;
    user.dataValues.activeSubscription = sub;
    user.dataValues.activePlan = sub ? sub.planType : 'free';
  }
  return users;
};

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
  const VALID_USER_ROLES = ['user', 'sub_admin', 'admin', 'super_admin', 'marketing', 'marketing_manager'];

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

  await attachActivePlans(users);

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
        attributes: ['id', 'email', 'phone', 'status'],
        // photos included so the reviewer can compare the selfie against the
        // member's profile gallery side-by-side
        include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto', 'photos'] }]
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

  // Allowlist status values. Admins can move a verification to ANY of these at
  // any time — re-open an approved one to 'pending', flag a suspicious one, or
  // reverse a rejection — not just the one-shot approve/reject it used to allow.
  const validVerificationStatuses = ['approved', 'rejected', 'pending', 'flagged'];
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

  // Notify user via in-app + email (non-blocking). Only fire on a REAL status
  // transition so re-saving the same status (e.g. editing notes) doesn't spam
  // the member. 'flagged' is an internal admin state — no member notification.
  if (status !== previousStatus) {
    setImmediate(async () => {
      try {
        const user = await User.findByPk(verification.userId, {
          attributes: ['email'],
          include: [{ model: Profile, attributes: ['firstName'] }]
        });
        if (!user) return;
        const name = user.Profile?.firstName || 'User';

        if (status === 'approved') {
          await notify(verification.userId, 'verification_approved', 'Profile Verified!', 'Your photo verification is complete. Your profile now shows a verified badge.');
          await sendVerificationApproved(user.email, name);
        } else if (status === 'rejected') {
          const reason = safeAdminNotes || 'Please resubmit a clear, well-lit selfie that matches your profile photos.';
          await notify(verification.userId, 'verification_rejected', 'Verification Update', `Your verification was not approved. ${reason}`);
          await sendVerificationRejected(user.email, name, reason);
        } else if (status === 'pending') {
          // Re-opened for another look — in-app only, no email.
          await notify(verification.userId, 'system', 'Verification under review', 'Our team is re-reviewing your photo verification. We\'ll update you shortly.');
        }
      } catch (err) {
        // Non-fatal — verification is already saved
      }
    });
  }

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
    unreadSupport,
    foundingGranted,
    profilesWithoutPhoto,
  ] = await Promise.all([
    // Total non-admin users
    User.count({ where: { role: 'user' } }),

    // Email-verified users
    User.count({ where: { role: 'user', emailVerified: true } }),

    // Active premium subscribers.
    // NOTE (Phase S): `founding_premium` is in PAID_PLANS, so founding grants
    // are counted here — the number is "members with premium entitlements", not
    // "members who paid". Revenue is unaffected (founding rows carry amount 0),
    // and planDistribution below breaks the two apart.
    Subscription.count({
      where: {
        status: 'active',
        planType: { [Op.in]: PAID_PLANS },
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

    // Unread support enquiries. The inbox had no badge anywhere, so a message
    // could sit unanswered indefinitely unless somebody thought to look.
    ContactMessage.count({ where: { status: 'new' } }),

    // Founding grants issued against the cap. The window is time-boxed AND
    // capped, and neither figure surfaced anywhere until it was already spent.
    Subscription.count({ where: { planType: FOUNDING_PLAN } }),

    // Profiles with no photograph — the strongest predictor of a member who
    // gets nowhere, and invisible from every other admin screen.
    Profile.count({ where: { photos: { [Op.eq]: [] } } }),
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
      unreadSupport,
      profilesWithoutPhoto,
      founding: {
        granted: foundingGranted,
        ...require('../utils/launchOffer').getFoundingState(),
      },
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

  const validStatuses = ['reviewing', 'resolved', 'reviewed', 'dismissed'];
  if (!validStatuses.includes(status)) {
    throw createError.badRequest('Status must be one of: reviewing, resolved, dismissed');
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

  // Notify reporter of the outcome
  const outcomeCopy = {
    reviewing: 'is being reviewed by our team',
    resolved: 'has been reviewed and action has been taken',
    reviewed: 'has been reviewed and action has been taken',
    dismissed: 'has been reviewed and dismissed',
  };
  await notify(
    report.reporterId,
    'report_reviewed',
    'Your report has been updated',
    `Your report ${outcomeCopy[status] || 'has been reviewed'}.`
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

  await attachActivePlans([user]);

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

  if (!ALL_PLANS.includes(planType)) {
    throw createError.badRequest(`planType must be one of: ${ALL_PLANS.join(', ')}`);
  }

  // Founding grants may only be minted WHILE the founding window is open. After
  // it closes the offer is retrospective ("founding families"), and an admin
  // override is the one remaining way to mint a new founding row — so it is
  // gated here rather than trusted.
  const foundingState = require('../utils/launchOffer').getFoundingState();
  if (planType === FOUNDING_PLAN && !foundingState.open) {
    throw createError.badRequest(
      'The founding-member period has closed — founding_premium can no longer be granted. Choose a paid plan instead.'
    );
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

  const isFounding = planType === FOUNDING_PLAN;

  // `founding_premium` has no entry in the razorpay PLANS map (it is granted,
  // not priced), so planDetails is null for it. Without this branch the row
  // would be created with contactUnlocksAllowed: null — which means UNLIMITED
  // unlocks in middlewares/auth.js. Same explicit bundle as utils/foundingGrant.
  // Term: the plan's OWN duration, not a flat 30 days. A hardcoded month meant
  // an admin granting the 90-day Premium silently handed out a third of it —
  // and the member saw a plan whose end date disagreed with the pricing page.
  // `getPlanDetails` is launch-offer aware, so a re-priced tenure follows here.
  const grantDays = planDetails?.duration || 30;
  const subEndDate = endDate
    ? new Date(endDate)
    : isFounding && foundingState.endsAt
      ? new Date(foundingState.endsAt)
      : new Date(Date.now() + grantDays * 24 * 60 * 60 * 1000);

  const subscription = await Subscription.create({
    userId,
    planType,
    status,
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: subEndDate,
    amount: planDetails ? planDetails.amount / 100 : 0,
    contactUnlocksAllowed: isFounding
      ? (foundingState.contactUnlocks ?? FOUNDING_CONTACT_UNLOCKS)
      : (planDetails ? planDetails.contactUnlocks : null),
    contactUnlocksUsed: 0,
  });

  // Unlimited-plan admin override: activate profile boost
  if (UNLIMITED_PLANS.includes(planType) && status === 'active') {
    await User.update(
      { isBoosted: true, boostExpiresAt: subEndDate },
      { where: { id: userId } }
    );
  }

  // Founding-ness is a User fact that outlives the row (upgrade supersedes it,
  // the cohort expires together), so stamp it here as the grant util does.
  if (isFounding && status === 'active') {
    await User.update({ isFoundingMember: true }, { where: { id: userId } });
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

// @route   DELETE /api/admin/users/:userId/subscription
// @desc    End a member's current plan now (revoke a grant, or close a refunded plan)
// @access  Private/Admin (scope: subscriptions)
//
// An admin could grant a plan but never take one back, so a mis-grant or a
// refunded payment had no in-product remedy at all — the only fix was a manual
// UPDATE against production. `reason` is recorded on the audit row because
// "why was this cancelled" is the question asked three months later.
exports.cancelSubscription = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';

  const user = await User.findByPk(userId);
  if (!user) throw createError.notFound('User not found');

  const active = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      planType: { [Op.in]: PAID_PLANS },
      [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }],
    },
    order: [['createdAt', 'DESC']],
  });
  if (!active) throw createError.badRequest('This member has no active plan to cancel');

  await active.update({ status: 'cancelled', endDate: new Date() });

  // Boost is a User-level flag granted alongside unlimited tiers, so it has to
  // come off with the plan — otherwise a cancelled VIP keeps their +8 forever.
  if (UNLIMITED_PLANS.includes(active.planType)) {
    await User.update({ isBoosted: false, boostExpiresAt: null }, { where: { id: userId } });
  }

  logAudit('subscription_cancelled', req.user.id, { userId, planType: active.planType, reason });

  await notify(
    userId,
    'system',
    'Membership ended',
    'Your membership has been ended by our team. Your profile and matches are unchanged.'
  );

  res.json({ success: true, message: 'Subscription cancelled', subscription: active });
});

// @route   GET /api/admin/users/export
// @desc    Members as CSV
// @access  Private/Admin (scope: users)
//
// Capped at 5,000 rows: this is an operational export for a launch-scale
// directory, not a data-warehouse dump, and an uncapped CSV of every row is a
// memory spike waiting for the day the table is large.
exports.exportUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city', 'gender', 'dateOfBirth', 'photos'] }],
    order: [['createdAt', 'DESC']],
    limit: 5000,
  });
  await attachActivePlans(users);

  const esc = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // A name containing a comma or a quote must not shift every later column.
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const header = ['Name', 'Email', 'Phone', 'City', 'Gender', 'Role', 'Status', 'Plan', 'Has photo', 'Joined'];
  const lines = [header.join(',')];
  for (const user of users) {
    const p = user.Profile;
    lines.push([
      esc([p?.firstName, p?.lastName].filter(Boolean).join(' ')),
      esc(user.email),
      esc(user.phone),
      esc(p?.city),
      esc(p?.gender),
      esc(user.role),
      esc(user.status),
      esc(user.dataValues.activePlan),
      esc(Array.isArray(p?.photos) && p.photos.length > 0 ? 'yes' : 'no'),
      esc(user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : ''),
    ].join(','));
  }

  logAudit('users_exported', req.user.id, { rows: users.length });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tricitymatch-members-${new Date().toISOString().slice(0, 10)}.csv"`);
  // BOM so Excel opens the ₹ sign and Indian names correctly rather than as mojibake.
  res.send('\uFEFF' + lines.join('\n'));
});

// @route   PUT /api/admin/leads/:leadId/status
// @desc    Move a marketing lead along the pipeline
// @access  Private/Admin (scope: marketing)
//
// The marketing portal could always do this; the admin panel could only look.
// An admin covering for a marketing user therefore had to log in as them.
// Deliberately NOT scoped to an assignee — an admin works any lead.
exports.updateLeadStatus = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const { status } = req.body;

  const VALID_LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];
  if (!VALID_LEAD_STATUSES.includes(status)) {
    throw createError.badRequest(`status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`);
  }

  const lead = await MarketingLead.findByPk(leadId);
  if (!lead) throw createError.notFound('Lead not found');

  await lead.update({ status });
  logAudit('lead_status_changed', req.user.id, { leadId, status });

  res.json({ success: true, message: 'Lead updated', lead });
});

// @route   GET /api/admin/plan-options
// @desc    Plans an admin may grant, resolved against the LIVE launch offer
// @access  Private/Admin (scope: subscriptions)
//
// The override dropdown used to be a hardcoded list — and it had drifted to
// values (`basic`, `premium`, `gold`) that are not in the Postgres enum, so
// every override 400'd at validation. Serving the list keeps it honest in both
// directions: it can never contain a key the validator rejects, and it tracks
// what the admin has actually put on sale in Pricing & Offers.
//
// Withdrawn tiers are still RETURNED (an admin grant is not a purchase, and
// support sometimes has to honour a tier that is off sale) but flagged
// `onSale:false` so the UI can separate them. `free` is always grantable —
// that is how you revoke a plan.
exports.getPlanOptions = asyncHandler(async (req, res) => {
  const { getPlanDetails, isPlanPurchasable } = require('../utils/razorpay');
  const foundingState = require('../utils/launchOffer').getFoundingState();

  const options = [{
    planType: 'free',
    label: 'Free',
    onSale: true,
    price: 0,
    durationDays: null,
    contactUnlocks: 0,
    note: 'Removes any paid plan',
  }];

  for (const planType of PAID_PLANS) {
    if (planType === FOUNDING_PLAN) {
      // Grantable only while the window is open — updateSubscription refuses
      // it otherwise, so offering it after close would be a dead option.
      if (!foundingState.open) continue;
      options.push({
        planType,
        label: 'Founding member (grant)',
        onSale: true,
        price: 0,
        durationDays: foundingState.grantDays ?? null,
        contactUnlocks: foundingState.contactUnlocks ?? FOUNDING_CONTACT_UNLOCKS,
        note: 'Free founding grant, while the window is open',
      });
      continue;
    }

    const details = getPlanDetails(planType);
    if (!details) continue;
    options.push({
      planType,
      label: details.name,
      onSale: isPlanPurchasable(planType),
      price: details.amount / 100,
      durationDays: details.duration,
      contactUnlocks: details.contactUnlocks,
      note: isPlanPurchasable(planType) ? null : 'Withdrawn from sale',
    });
  }

  res.json({ success: true, options });
});

// ==================== ADMIN TEAM (sub-admins & role grants) ====================

/**
 * Who may hand out what.
 *
 * Rank, not a role whitelist: an actor may never mint or modify an account
 * that outranks them, and may never grant a role above their own. `sub_admin`
 * appears here because the `team` scope can be granted to one — but a scoped
 * actor is additionally held to the scopes it holds itself (below), so it
 * cannot bootstrap an account more powerful than itself.
 */
const ROLE_RANK = { sub_admin: 1, admin: 2, super_admin: 3 };
const GRANTABLE_ROLES = Object.keys(ROLE_RANK);

const rankOf = (role) => ROLE_RANK[role] || 0;

/**
 * Guard shared by createAdmin and updateUserRole.
 *
 * The scope-subset rule is the one that stops privilege escalation sideways:
 * without it a `sub_admin` holding only `team` could create a peer holding
 * `pricing` and act through it.
 */
const assertMayGrant = (actor, targetRole, scopes) => {
  if (!GRANTABLE_ROLES.includes(targetRole)) {
    throw createError.badRequest(`role must be one of: ${GRANTABLE_ROLES.join(', ')}`);
  }
  if (rankOf(targetRole) > rankOf(actor.role)) {
    throw createError.forbidden(`You cannot grant a role above your own (${actor.role})`);
  }
  if (!FULL_ACCESS_ROLES.includes(actor.role)) {
    const mine = scopesFor(actor);
    const over = scopes.filter((sc) => !mine.includes(sc));
    if (over.length) {
      throw createError.forbidden(`You cannot grant permissions you do not hold: ${over.join(', ')}`);
    }
  }
};

/** Refuse the change that leaves nobody able to administer the site. */
const assertNotLastFullAdmin = async (targetUser, nextRole) => {
  if (!FULL_ACCESS_ROLES.includes(targetUser.role)) return;
  if (FULL_ACCESS_ROLES.includes(nextRole)) return;
  const remaining = await User.count({
    where: {
      role: { [Op.in]: FULL_ACCESS_ROLES },
      status: 'active',
      id: { [Op.ne]: targetUser.id },
    },
  });
  if (remaining === 0) {
    throw createError.badRequest(
      'This is the last full admin account — promote someone else before demoting it.'
    );
  }
};

const serializeAdmin = (user) => ({
  id: user.id,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  firstName: user.Profile?.firstName || null,
  lastName: user.Profile?.lastName || null,
  permissions: scopesFor(user),
  // A full-access role holds every scope implicitly, so the UI must not render
  // its checkboxes as an editable stored list.
  fullAccess: FULL_ACCESS_ROLES.includes(user.role),
});

// @route   GET /api/admin/admins
// @desc    List admin accounts + the scope catalogue
// @access  Private/Admin (scope: team)
exports.getAdmins = asyncHandler(async (req, res) => {
  const admins = await User.findAll({
    where: { role: { [Op.in]: ADMIN_ROLES } },
    include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
    order: [['createdAt', 'ASC']],
  });

  res.json({
    success: true,
    admins: admins.map(serializeAdmin),
    scopes: ADMIN_SCOPES,
    // What THIS actor may do, so the UI does not offer a control the server
    // will refuse: an `admin` cannot mint a `super_admin`, and a scoped
    // sub-admin cannot hand out scopes it does not hold.
    grantableRoles: GRANTABLE_ROLES.filter((r) => rankOf(r) <= rankOf(req.user.role)),
    grantableScopes: FULL_ACCESS_ROLES.includes(req.user.role) ? ALL_SCOPES : scopesFor(req.user),
  });
});

// @route   POST /api/admin/admins
// @desc    Create a NEW admin/sub-admin account
// @access  Private/Admin (scope: team)
exports.createAdmin = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone, role = 'sub_admin' } = req.body;
  const permissions = sanitizeScopes(
    Array.isArray(req.body.permissions) ? req.body.permissions : DEFAULT_SUB_ADMIN_SCOPES
  );

  if (!email || !password || !firstName) {
    throw createError.badRequest('email, password and firstName are required');
  }

  assertMayGrant(req.user, role, permissions);

  if (role === 'sub_admin' && permissions.length === 0) {
    throw createError.badRequest('A sub-admin with no permissions cannot do anything — pick at least one.');
  }

  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw createError.conflict(
      'An account with this email already exists — promote it from the Users page instead.'
    );
  }

  const created = await sequelize.transaction(async (t) => {
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      phone: phone || null,
      role,
      status: 'active',
      emailVerified: true,
      // Only sub_admins carry a stored list; full-access roles resolve every
      // scope at read time (constants/adminScopes.js).
      adminPermissions: role === 'sub_admin' ? permissions : null,
    }, { transaction: t });

    // A Profile row is required by everything that renders a person (the panel
    // header, the users table), so mint a minimal one exactly as createUser does.
    await Profile.create({
      userId: user.id,
      firstName,
      lastName: lastName || '',
      gender: 'other',
      dateOfBirth: new Date('1990-01-01'),
    }, { transaction: t });

    return user;
  });

  logAudit('admin_account_created', req.user.id, {
    newAdminId: created.id, email: created.email, role, permissions,
  });

  const user = await User.findByPk(created.id, {
    include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
  });

  res.status(201).json({ success: true, message: 'Admin account created', admin: serializeAdmin(user) });
});

// @route   PUT /api/admin/users/:userId/role
// @desc    Promote a member to admin/sub-admin, change scopes, or revoke
// @access  Private/Admin (scope: team)
exports.updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  const permissions = sanitizeScopes(req.body.permissions);

  // Self-edit is refused outright: it is the shape of both accidents (locking
  // yourself out of the panel) and abuse (a scoped account widening itself).
  if (userId === req.user.id) {
    throw createError.badRequest('You cannot change your own role or permissions — ask another admin.');
  }

  const target = await User.findByPk(userId, {
    include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
  });
  if (!target) throw createError.notFound('User not found');

  // Revoking: role 'user' hands the account back to being an ordinary member.
  const nextRole = role === 'user' ? 'user' : role;
  if (nextRole !== 'user') {
    assertMayGrant(req.user, nextRole, permissions);
    if (nextRole === 'sub_admin' && permissions.length === 0) {
      throw createError.badRequest('A sub-admin with no permissions cannot do anything — pick at least one.');
    }
  } else if (!GRANTABLE_ROLES.includes(target.role)) {
    throw createError.badRequest('This account is not an admin.');
  }

  // You may not touch an account that outranks you — in either direction.
  if (rankOf(target.role) > rankOf(req.user.role)) {
    throw createError.forbidden(`You cannot modify a ${target.role} account`);
  }

  await assertNotLastFullAdmin(target, nextRole);

  const previousRole = target.role;
  target.role = nextRole;
  target.adminPermissions = nextRole === 'sub_admin' ? permissions : null;
  await target.save();

  logAudit('admin_role_changed', req.user.id, {
    targetUserId: target.id, previousRole, nextRole, permissions,
  });

  // Tell the person their access changed — a silent grant means the new admin
  // never logs in, and a silent revoke reads as the panel being broken.
  await notify(
    target.id,
    'system',
    nextRole === 'user' ? 'Admin access removed' : 'Admin access granted',
    nextRole === 'user'
      ? 'Your administrator access to TricityMatch has been removed.'
      : `You now have ${nextRole === 'sub_admin' ? 'limited admin' : 'admin'} access to TricityMatch.`
  );

  res.json({ success: true, message: 'Role updated', admin: serializeAdmin(target) });
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
    // Sanitize CSV fields against formula injection. Excel and Sheets also treat
    // a leading TAB or CR as a formula lead-in, so they belong in the prefix set;
    // and any cell is then RFC4180-quoted so a value containing a comma, quote or
    // newline cannot break out into a new column or row. Today every column here
    // is a date, an enum or a number, but this function is the kind of thing that
    // gets reused for a user-supplied column later.
    const csvSafe = (v) => {
      const raw = String(v == null ? '' : v);
      const guarded = /^[=+\-@|\t\r]/.test(raw) ? `'${raw}` : raw;
      return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
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
  // Same rule as the member-facing endpoint: no receipt for a ₹0 grant, and
  // none for an order that was created but never paid. An admin handing a
  // member a PDF for money that never arrived is worse than no PDF.
  if (!subscription.amount || parseFloat(subscription.amount) === 0) {
    throw createError.badRequest('Invoice not available for a free or granted plan');
  }
  if (subscription.status === 'pending' && !subscription.razorpayPaymentId) {
    throw createError.badRequest('This payment was never completed, so there is no invoice for it');
  }

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

  const user = await User.findByPk(userId, {
    include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city'] }],
    attributes: { exclude: ['password'] },
  });
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
    user,
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
  const { isActive, marketingUserId } = req.query;

  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (marketingUserId) where.marketingUserId = marketingUserId;

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
  const VALID_PAYMENT_STATUSES = ['none', 'paid'];

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

// ==================== SUCCESS STORIES (admin-managed) ====================

// @route   GET /api/v1/admin/success-stories
// @desc    List all success stories (any status) for moderation
// @access  Admin
exports.getSuccessStories = asyncHandler(async (req, res) => {
  const stories = await SuccessStory.findAll({
    order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']],
  });
  res.json({ success: true, stories });
});

const sanitizeStoryInput = (body) => {
  const { coupleNames, location, marriedOn, quote, photoUrl, tag, status, displayOrder } = body;
  const out = {};
  if (coupleNames !== undefined) out.coupleNames = String(coupleNames).trim();
  if (location !== undefined) out.location = location ? String(location).trim() : null;
  if (marriedOn !== undefined) out.marriedOn = marriedOn || null;
  if (quote !== undefined) out.quote = String(quote).trim();
  if (photoUrl !== undefined) out.photoUrl = photoUrl ? String(photoUrl).trim() : null;
  if (tag !== undefined) out.tag = tag ? String(tag).trim().slice(0, 64) : null;
  if (status !== undefined && ['draft', 'published'].includes(status)) out.status = status;
  if (displayOrder !== undefined) out.displayOrder = parseInt(displayOrder, 10) || 0;
  return out;
};

// @route   POST /api/v1/admin/success-stories
// @desc    Create a success story (defaults to draft)
// @access  Admin
exports.createSuccessStory = asyncHandler(async (req, res) => {
  const data = sanitizeStoryInput(req.body);
  if (!data.coupleNames || !data.quote) {
    throw createError.badRequest('coupleNames and quote are required');
  }
  const story = await SuccessStory.create(data);
  res.status(201).json({ success: true, story });
});

// @route   PUT /api/v1/admin/success-stories/:id
// @desc    Update / publish a success story
// @access  Admin
exports.updateSuccessStory = asyncHandler(async (req, res) => {
  const story = await SuccessStory.findByPk(req.params.id);
  if (!story) throw createError.notFound('Story not found');
  await story.update(sanitizeStoryInput(req.body));
  res.json({ success: true, story });
});

// @route   DELETE /api/v1/admin/success-stories/:id
// @desc    Delete a success story
// @access  Admin
exports.deleteSuccessStory = asyncHandler(async (req, res) => {
  const story = await SuccessStory.findByPk(req.params.id);
  if (!story) throw createError.notFound('Story not found');
  await story.destroy();
  res.json({ success: true, message: 'Story deleted' });
});

// @route   GET /api/v1/success-stories  (public, no auth)
// @desc    Published success stories for the public site
// @access  Public
exports.getPublicSuccessStories = asyncHandler(async (req, res) => {
  const stories = await SuccessStory.findAll({
    where: { status: 'published' },
    attributes: ['id', 'coupleNames', 'location', 'marriedOn', 'quote', 'photoUrl', 'tag'],
    order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']],
  });
  res.json({ success: true, stories });
});


// ==================== CONTACT MESSAGES (SUPPORT INBOX) ====================

// @route   GET /api/v1/admin/contact-messages
// @desc    List public contact-form enquiries (support inbox)
// @access  Private/Admin
exports.getContactMessages = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const { status, search } = req.query;

  const VALID_STATUSES = ['new', 'read', 'resolved'];
  const where = {};
  if (status && VALID_STATUSES.includes(status)) where.status = status;
  if (search) {
    const term = `%${escapeLikePattern(search)}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { subject: { [Op.iLike]: term } },
      { message: { [Op.iLike]: term } },
    ];
  }

  const { count, rows: messages } = await ContactMessage.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const newCount = await ContactMessage.count({ where: { status: 'new' } });

  res.json({
    success: true,
    messages,
    newCount,
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
  });
});

// @route   PUT /api/v1/admin/contact-messages/:id
// @desc    Update enquiry status (new/read/resolved)
// @access  Private/Admin
exports.updateContactMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const VALID_STATUSES = ['new', 'read', 'resolved'];
  if (!VALID_STATUSES.includes(status)) {
    throw createError.badRequest('Status must be one of: new, read, resolved');
  }

  const message = await ContactMessage.findByPk(id);
  if (!message) throw createError.notFound('Message not found');

  const previous = message.status;
  message.status = status;
  await message.save();

  logAudit('contact_message_status_changed', req.user.id, { id, previous, status });

  res.json({ success: true, message });
});

// ==================== LAUNCH OFFER (PRICING) ====================

// @route   GET /api/v1/admin/launch-offer
// @desc    Current launch-offer config + the regular ladder it overlays
// @access  Private/Admin
// The response deliberately carries BOTH ladders: an admin editing launch
// prices needs to see what each tier reverts to when the window closes, and
// the effective (charged) price so there is no doubt what a member pays today.
exports.getLaunchOffer = asyncHandler(async (req, res) => {
  const { getOffer, buildDefaults, getOfferState, getFoundingState } = require('../utils/launchOffer');
  const { PLANS, UNLOCK_BUNDLES, getPlanDetails, getBundleDetails } = require('../utils/razorpay');

  const offer = getOffer() || buildDefaults();

  const regular = {};
  const effective = {};
  for (const key of Object.keys(PLANS)) {
    const base = PLANS[key];
    const live = getPlanDetails(key);
    regular[key] = {
      name: base.name,
      price: base.amount / 100,
      durationDays: base.duration,
      contactUnlocks: base.contactUnlocks,
    };
    effective[key] = {
      price: live.amount / 100,
      durationDays: live.duration,
      contactUnlocks: live.contactUnlocks,
      isLaunchPrice: Boolean(live.isLaunchPrice),
      // Withdrawn for the current window: no card is rendered and create-order
      // refuses it. The regular figures above still resolve, because members
      // already holding the tier must keep working.
      hidden: Boolean(live.hidden),
    };
  }

  const bundles = {};
  for (const id of Object.keys(UNLOCK_BUNDLES)) {
    const live = getBundleDetails(id);
    bundles[id] = {
      name: UNLOCK_BUNDLES[id].name,
      unlocks: UNLOCK_BUNDLES[id].unlocks,
      regularPrice: UNLOCK_BUNDLES[id].amount / 100,
      price: live ? live.amount / 100 : null,
      hidden: !live,
    };
  }

  res.json({
    success: true,
    offer,
    state: getOfferState(),
    founding: getFoundingState(),
    regular,
    effective,
    bundles,
  });
});

// @route   PUT /api/v1/admin/launch-offer
// @desc    Update launch pricing / deadline / founding window
// @access  Private/Admin
// Validation lives in utils/launchOffer.saveOffer (one place, so the HTTP path
// and any future script path cannot diverge on what a legal price is).
exports.updateLaunchOffer = asyncHandler(async (req, res) => {
  const { saveOffer, OfferValidationError, getOfferState, getFoundingState } = require('../utils/launchOffer');

  let saved;
  try {
    saved = await saveOffer(req.body, req.user.id);
  } catch (err) {
    if (err instanceof OfferValidationError) throw createError.badRequest(err.message);
    throw err;
  }

  logAudit('launch_offer_updated', req.user.id, {
    enabled: saved.enabled,
    endsAt: saved.endsAt,
    foundingEnabled: saved.founding?.enabled,
    foundingCap: saved.founding?.memberCap,
  });

  res.json({
    success: true,
    offer: saved,
    state: getOfferState(),
    founding: getFoundingState(),
  });
});

// @route   POST /api/v1/admin/contact-messages/:id/reply
// @desc    Reply to a support enquiry (emails the enquirer, records the reply)
// @access  Private/Admin
// Support used to be write-only: the form stored the enquiry and fired a
// notification at SUPPORT_EMAIL, and answering meant finding whatever mailbox
// that landed in. This is the answer path — and unlike the notification, a
// FAILED send is reported, because an admin who thinks they replied and did
// not is worse than one who knows the send failed.
exports.replyToContactMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = String(req.body?.body ?? '').trim();

  if (body.length < 2) throw createError.badRequest('Reply body is required');
  if (body.length > 5000) throw createError.badRequest('Reply is too long (max 5000 characters)');

  const message = await ContactMessage.findByPk(id);
  if (!message) throw createError.notFound('Message not found');

  const result = await sendSupportReply(message.email, message.name, body, message.message);
  if (!result?.success) {
    log.error('Support reply failed to send', { id, error: result?.error });
    throw createError.internal(
      `Reply could not be sent: ${result?.error || result?.reason || 'email provider unavailable'}. Nothing was recorded — try again.`
    );
  }

  message.replyBody = body;
  message.repliedAt = new Date();
  message.repliedBy = req.user.id;
  // Answering IS resolving; leaving it "new" after a reply is how inboxes rot.
  message.status = 'resolved';
  await message.save();

  logAudit('contact_message_replied', req.user.id, { id, to: message.email });

  res.json({ success: true, message });
});
