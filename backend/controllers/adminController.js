/**
 * Admin Controller
 * Administrative operations with proper authorization
 */

const { User, Profile, Subscription, Match, Verification, ProfileView, Report, ReferralCode, MarketingLead, SuccessStory, ContactMessage } = require('../models');
const { canonicalEmail, emailLookupCandidates } = require('../utils/emailAddress');
const { buildMarketingReport, getRepRevenue } = require('../utils/marketingReport');
const { buildLeadWhere, summariseLeads, memberFacts, partnerName, PAID_MEMBER_IDS_SQL } = require('../utils/partnerMembers');
const { PAID_SUBSCRIPTION_WHERE, PAID_SUBSCRIPTION_SQL } = require('../utils/paidRevenue');
const {
  getCommissionSettings,
  saveCommissionSettings,
  CommissionValidationError,
} = require('../utils/marketingCommission');
const {
  getPayoutLedger,
  recordPayout,
  updatePayoutStatus,
  voidPayout,
  PayoutValidationError,
} = require('../utils/marketingPayouts');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { hasScope } = require('../constants/adminScopes');
const { PAID_PLANS, ALL_PLANS, UNLIMITED_PLANS, FOUNDING_PLAN, FOUNDING_CONTACT_UNLOCKS } = require('../constants/plans');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');
const { buildModerationHistory } = require('../utils/moderationHistory');
const { csvCell } = require('../utils/csv');
const { streamCsv } = require('../utils/csvStream');
const { isSystemReview } = require('../utils/underageFlag');
const { generateInvoicePDF } = require('../utils/invoice');
const { hardDeleteUsers, MAX_BATCH } = require('../utils/hardDeleteUsers');
const { marriageableAgeProblem } = require('../constants/marriageableAge');
const { findContactInText } = require('../utils/contactInText');
const { ASSISTED_SIGNUP_TERMS } = require('../constants/legal');
const { invoiceBlocker } = require('../utils/invoiceEligibility');
const { recordRefund } = require('../utils/paymentRefunds');
const { notify } = require('../utils/notifyUser');
const { sendVerificationApproved, sendVerificationRejected, sendSupportReply, sendPartnerWelcome } = require('../utils/email');
const { getOnboarding, getOnboardingBatch } = require('../utils/partnerOnboarding');
const { reassignLeads, countOpenLeads, LeadReassignError } = require('../utils/leadReassignment');
const { normalizePhone } = require('../utils/smsService');
const { RefreshToken } = require('../models');
const { markUserRevoked } = require('../utils/sessionRevocation');
const { passwordProblem } = require('../utils/passwordPolicy');
const { fingerprintOf } = require('../utils/verificationFingerprint');
const { planEndDate, termEndDate } = require('../utils/planTerm');
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
    // An erased account keeps its Subscription rows as financial records, but
    // it holds no plan: listing it as "Founding · Active" misreports the member.
    const sub = user.status === 'deleted' ? null : (byUser.get(user.id) || null);
    user.dataValues.activeSubscription = sub;
    user.dataValues.activePlan = sub ? sub.planType : 'free';
  }
  return users;
};

// ---- read-audit de-duplication ---------------------------------------------
// Opening a member page fires several reads (and the page reloads after every
// action on it), and each used to write its own audit row — the trail filled with
// identical "record viewed" lines and drowned the actions that matter. One row
// per admin, member and kind inside a short window still answers "who looked at
// this member, and when".
const VIEW_AUDIT_WINDOW_MS = 5 * 60 * 1000;
const recentViews = new Map();
const auditViewOnce = (action, actorId, targetUserId) => {
  const key = `${action}:${actorId}:${targetUserId}`;
  const now = Date.now();
  const last = recentViews.get(key);
  if (last && now - last < VIEW_AUDIT_WINDOW_MS) return;
  recentViews.set(key, now);
  if (recentViews.size > 5000) {
    for (const [k, t] of recentViews) if (now - t >= VIEW_AUDIT_WINDOW_MS) recentViews.delete(k);
  }
  logAudit(action, actorId, { targetUserId });
};

// ---- phone handling for admin-created accounts ------------------------------
// Admin forms used to store whatever was typed and never checked the number was
// free, so a duplicate surfaced as a 500 ("current transaction is aborted") from
// the unique index inside the create transaction. Normalise to the same canonical
// digits signup stores, and say plainly when the number is taken.
const cleanPhone = (raw) => {
  if (raw == null || String(raw).trim() === '') return null;
  // The Users.phone column holds the bare 10-digit national number (model
  // validator ^[6-9]\d{9}$); signup and login compare against that form.
  const national = (normalizePhone(String(raw)) || '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(national)) throw createError.badRequest('Enter a valid 10-digit Indian mobile number');
  return national;
};

const assertPhoneFree = async (phone, exceptUserId = null) => {
  if (!phone) return;
  // Be generous about what else could already be on file for the same number.
  const candidates = [phone, `91${phone}`, `+91${phone}`];
  const where = { phone: { [Op.in]: candidates } };
  if (exceptUserId) where.id = { [Op.ne]: exceptUserId };
  const taken = await User.findOne({ where, attributes: ['id'] });
  if (taken) throw createError.conflict('That mobile number is already used by another account');
};

// Escape special characters for LIKE patterns
const escapeLikePattern = (str) => {
  if (!str) return str;
  return str.replace(/[%_\\]/g, '\\$&');
};

const VALID_USER_STATUSES = ['active', 'inactive', 'banned', 'pending', 'deleted'];
const VALID_USER_ROLES = ['user', 'sub_admin', 'admin', 'super_admin', 'marketing', 'marketing_manager'];
const SUB_ADMIN_REFUND_LIMIT_RUPEES = 1000;
const TEST_EMAIL_PATTERNS = ['%@example.com', '%@loadtest.local', '%@test.com'];
const ACTIVE_SUB_SQL = (planSql) => `SELECT "userId" FROM "Subscriptions"
  WHERE status = 'active' AND ${planSql} AND ("endDate" IS NULL OR "endDate" > NOW())`;

const isYmd = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// Member lookup by whatever support is handed: a phone number typed any way
// ("+91 98765 10001", "98765-10001"), the TCS- code on the member's profile, or
// the account id from a log line. A plain ILIKE found none of those unless the
// digits were typed exactly as stored.
const { parseProfileCode } = require('../utils/profileCode');
const { istYmd, istDayStart, istDayEnd, istTodayStart } = require('../utils/istDay');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROFILE_CODE_RE = /^TCS-[0-9A-F]{8}$/i;
const PHONE_LIKE_RE = /^[+\d\s().-]+$/;

const memberSearchWhere = (raw) => {
  const search = String(raw).trim();
  if (UUID_RE.test(search)) return { id: search.toLowerCase() };
  if (PROFILE_CODE_RE.test(search)) {
    // The code is the first eight hex digits of the id, so this is an indexed
    // range over the primary key rather than a cast-and-LIKE scan.
    const prefix = parseProfileCode(search);
    return { id: { [Op.between]: [`${prefix}-0000-0000-0000-000000000000`, `${prefix}-ffff-ffff-ffff-ffffffffffff`] } };
  }
  const like = `%${escapeLikePattern(search)}%`;
  const or = [
    { email: { [Op.iLike]: like } },
    { phone: { [Op.iLike]: like } },
    sequelize.literal(`"User"."id" IN (SELECT "userId" FROM "Profiles" WHERE ("firstName" || ' ' || COALESCE("lastName", '')) ILIKE ${sequelize.escape(like)})`),
  ];
  // Numbers are stored as the bare 10 digits; a contact number can differ from
  // the sign-in one. Only for input that is nothing but a number, so an email
  // or a name with digits in it keeps its plain meaning.
  const digits = search.replace(/\D/g, '');
  if (PHONE_LIKE_RE.test(search) && digits.length >= 7) {
    const tail = `%${digits.slice(-10)}%`;
    or.push({ phone: { [Op.iLike]: tail } }, { contactPhone: { [Op.iLike]: tail } });
  }
  return { [Op.or]: or };
};

/**
 * Turn the admin filter query into a Sequelize where. Every value is checked
 * against an allowlist / strict format before it reaches a literal, and
 * sequelize.escape() quotes anything that is interpolated.
 */
const buildUserWhere = (query) => {
  const {
    status, role, search, joinedFrom, joinedTo, joinedWithin, plan, verified,
    hasPhoto, gender, city, emailVerified, phoneVerified, inactiveDays, testAccounts, visibility,
  } = query;
  const and = [];
  const yes = (v) => v === 'yes';
  const no = (v) => v === 'no';
  const inSub = (userSql, negate) => sequelize.literal(`"User"."id" ${negate ? 'NOT ' : ''}IN (${userSql})`);

  if (status && VALID_USER_STATUSES.includes(status)) and.push({ status });
  if (role && VALID_USER_ROLES.includes(role)) and.push({ role });
  if (search && String(search).trim()) and.push(memberSearchWhere(search));

  // Whole days in India time: someone who joined at 00:30 IST on the 11th
  // joined on the 11th, though it is still the 10th in UTC.
  if (isYmd(joinedFrom)) and.push({ createdAt: { [Op.gte]: istDayStart(joinedFrom) } });
  if (isYmd(joinedTo)) and.push({ createdAt: { [Op.lt]: istDayEnd(joinedTo) } });
  if (joinedWithin === 'today') and.push({ createdAt: { [Op.gte]: istTodayStart() } });
  const within = parseInt(joinedWithin, 10);
  if (within > 0 && within <= 3650) and.push({ createdAt: { [Op.gte]: new Date(Date.now() - within * 86400000) } });

  const quoted = (list) => list.map((p) => sequelize.escape(p)).join(',');
  const paidTier = `"planType" IN (${quoted(PAID_PLANS)})`;
  // A live plan belongs to a live account: an erased member keeps their rows as
  // financial records but holds no plan (attachActivePlans lists them as Free).
  const liveAccount = () => and.push({ status: { [Op.ne]: 'deleted' } });
  if (plan === 'free') and.push(inSub(ACTIVE_SUB_SQL(paidTier), true));
  else if (plan === 'paying') {
    // Bought with real money: the one revenue predicate (a payment reference,
    // not fully refunded) on a live plan. Founding and staff grants are not this.
    liveAccount();
    and.push(inSub(ACTIVE_SUB_SQL(`${paidTier} AND ${PAID_SUBSCRIPTION_SQL}`)));
  } else if (plan === 'premium' || plan === 'paid') {
    // Any live premium plan, founding and staff grants included. 'paid' is the
    // old name for this, kept so saved views and links keep their meaning.
    liveAccount();
    and.push(inSub(ACTIVE_SUB_SQL(paidTier)));
  } else if (plan === 'granted') {
    // A paid tier handed out by staff: no payment behind it, not a founding place.
    liveAccount();
    and.push(inSub(ACTIVE_SUB_SQL(`${paidTier} AND "planType" <> ${sequelize.escape(FOUNDING_PLAN)} AND "razorpayPaymentId" IS NULL`)));
  } else if (plan === 'expiring') {
    liveAccount();
    and.push(inSub(`SELECT "userId" FROM "Subscriptions" WHERE status = 'active' AND ${paidTier}
      AND "endDate" > NOW() AND "endDate" < NOW() + INTERVAL '7 days'`));
  } else if (plan === 'lapsed') {
    // Had a paid plan once, has none live now.
    and.push(inSub(`SELECT "userId" FROM "Subscriptions" WHERE ${paidTier} AND "razorpayPaymentId" IS NOT NULL`));
    and.push(inSub(ACTIVE_SUB_SQL(paidTier), true));
  } else if (PAID_PLANS.includes(plan)) {
    liveAccount();
    and.push(inSub(ACTIVE_SUB_SQL(`"planType" = ${sequelize.escape(plan)}`)));
  }

  if (verified === 'yes' || verified === 'no' || verified === 'pending') {
    if (verified === 'yes') and.push(inSub(`SELECT "userId" FROM "Verifications" WHERE status = 'approved'`));
    if (verified === 'pending') and.push(inSub(`SELECT "userId" FROM "Verifications" WHERE status = 'pending'`));
    if (verified === 'no') and.push(inSub(`SELECT "userId" FROM "Verifications" WHERE status = 'approved'`, true));
  }
  if (yes(hasPhoto)) and.push(inSub(`SELECT "userId" FROM "Profiles" WHERE COALESCE(array_length(photos, 1), 0) > 0`));
  if (no(hasPhoto)) and.push(inSub(`SELECT "userId" FROM "Profiles" WHERE COALESCE(array_length(photos, 1), 0) > 0`, true));
  if (['male', 'female', 'other'].includes(gender)) and.push(inSub(`SELECT "userId" FROM "Profiles" WHERE gender = ${sequelize.escape(gender)}`));
  if (city && String(city).length <= 60) and.push(inSub(`SELECT "userId" FROM "Profiles" WHERE city ILIKE ${sequelize.escape(`%${escapeLikePattern(String(city))}%`)}`));
  if (yes(emailVerified) || no(emailVerified)) and.push({ emailVerified: yes(emailVerified) });
  if (yes(phoneVerified) || no(phoneVerified)) and.push({ phoneVerified: yes(phoneVerified) });

  const idle = parseInt(inactiveDays, 10);
  if (idle > 0 && idle <= 3650) {
    and.push({ [Op.or]: [{ lastLogin: null }, { lastLogin: { [Op.lt]: new Date(Date.now() - idle * 86400000) } }] });
  }

  // Members an admin made invisible (quiet hide).
  if (visibility === 'hidden') and.push({ hiddenAt: { [Op.ne]: null } });
  if (visibility === 'visible') and.push({ hiddenAt: null });

  if (testAccounts === 'only' || testAccounts === 'exclude') {
    const testOr = { [Op.or]: TEST_EMAIL_PATTERNS.map((pat) => ({ email: { [Op.iLike]: pat } })) };
    and.push(testAccounts === 'only' ? testOr : { [Op.not]: testOr });
  }
  return and.length ? { [Op.and]: and } : {};
};

const userOrder = (sort) => {
  if (sort === 'oldest') return [['createdAt', 'ASC']];
  if (sort === 'lastLogin') return [[sequelize.literal('"User"."lastLogin" DESC NULLS LAST')]];
  return [['createdAt', 'DESC']];
};

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100); // cap at 100 rows per page
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const where = buildUserWhere(req.query);

  const { count, rows: users } = await User.findAndCountAll({
    where,
    include: [
      { model: Profile, attributes: ['firstName', 'lastName', 'city', 'gender', 'photos'] },
      // separate:true runs a dedicated query per user — required for limit+order on HasMany in findAndCountAll
      { model: Subscription, separate: true, order: [['createdAt', 'DESC']], limit: 1 }
    ],
    limit,
    offset,
    order: userOrder(req.query.sort),
    subQuery: false,
  });

  await attachActivePlans(users);
  for (const u of users) {
    u.dataValues.invisible = u.hiddenAt ? { since: u.hiddenAt, reason: u.hiddenReason } : null;
  }

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

// @route   DELETE /api/admin/users   body { ids: [uuid] }
// @desc    Permanently delete member accounts (bulk). Full admins only.
// @access  Private/Admin
exports.deleteUsers = asyncHandler(async (req, res) => {
  if (!FULL_ACCESS_ROLES.includes(req.user.role)) {
    throw createError.forbidden('Only a full admin can permanently delete accounts');
  }
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) throw createError.badRequest('Select at least one account');
  if (ids.length > MAX_BATCH) throw createError.badRequest(`Delete at most ${MAX_BATCH} accounts at a time`);
  if (!ids.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))) {
    throw createError.badRequest('Invalid account id');
  }

  const result = await hardDeleteUsers(ids, req.user.id);
  logAudit('users_hard_deleted', req.user.id, {
    deletedCount: result.deleted.length,
    deleted: result.deleted,
    blocked: result.blocked,
  });

  res.json({ success: true, ...result });
});

// @route   PUT /api/admin/users/:userId/visibility   body { hidden, reason }
// @desc    Make a member invisible to other members, or visible again
// @access  Private/Admin (scope: users)
//
// A "quiet hide": the member is left out of search, daily matches, profile-code
// lookups, saved-search alerts and the weekly digest, but can still sign in, and
// anyone they like or message can still see them (as with incognito). They are
// not told. Staff are never listed anyway, so only member accounts take this.
exports.updateUserVisibility = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { hidden } = req.body || {};
  if (typeof hidden !== 'boolean') throw createError.badRequest('hidden must be true or false');
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
  if (hidden && reason.length < 3) {
    throw createError.badRequest('Add a short reason so the next admin knows why this member is hidden');
  }

  const user = await User.findByPk(userId, { attributes: ['id', 'role', 'hiddenAt', 'hiddenBy', 'hiddenReason'] });
  if (!user) throw createError.notFound('User not found');
  if (user.role !== 'user') {
    throw createError.badRequest('Staff accounts are never shown to members, so there is nothing to hide');
  }

  const wasHidden = Boolean(user.hiddenAt);
  if (hidden) {
    // Re-hiding keeps the original time but takes the new reason.
    await user.update({ hiddenAt: user.hiddenAt || new Date(), hiddenBy: req.user.id, hiddenReason: reason });
  } else if (wasHidden) {
    await user.update({ hiddenAt: null, hiddenBy: null, hiddenReason: null });
  }

  if (hidden || wasHidden) {
    logAudit(hidden ? 'member_hidden' : 'member_unhidden', req.user.id, {
      targetUserId: userId,
      reason: hidden ? reason : undefined,
    });
  }

  res.json({
    success: true,
    invisible: user.hiddenAt
      ? { since: user.hiddenAt, reason: user.hiddenReason, byEmail: req.user.email || null }
      : null,
  });
});

// A suspended member cannot sign in to read the in-app notice, so the decision,
// the reason and the way to appeal also go by email. Resolves true when the mail
// was accepted for delivery. Never throws: the status has already changed, and a
// slow or failing mail service must not hold up or fail the admin's action.
const STATUS_MAIL_TIMEOUT_MS = 8000;
const mailAccountStatus = async (user, suspended, reason) => {
  try {
    const { sendAccountStatusEmail } = require('../utils/email');
    const profile = await Profile.findOne({ where: { userId: user.id }, attributes: ['firstName'] });
    let timer;
    const timedOut = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ success: false, error: 'timed out' }), STATUS_MAIL_TIMEOUT_MS);
    });
    const sent = await Promise.race([
      sendAccountStatusEmail(user.email, profile?.firstName || null, suspended, reason || null),
      timedOut,
    ]).finally(() => clearTimeout(timer));
    if (sent?.success) return true;
    log.warn('Account status mail not sent', { targetUserId: user.id, suspended, error: sent?.error || sent?.reason || 'unknown' });
  } catch (err) {
    log.warn('Account status mail not sent', { targetUserId: user.id, suspended, error: err.message });
  }
  return false;
};

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

  // Staff accounts are managed through Admins & Roles, and never by themselves.
  // This route used to change ANY account's status: a support sub-admin holding
  // only `users` could ban an admin (or the last super_admin), and an admin could
  // deactivate their own account and lock the site out of administration.
  if (user.id === req.user.id) {
    throw createError.badRequest('You cannot change the status of your own account');
  }
  if (user.role !== 'user') {
    if (!FULL_ACCESS_ROLES.includes(req.user.role) && !scopesFor(req.user).includes('team')) {
      throw createError.forbidden('Only an admin who manages the team can change a staff account');
    }
    if (rankOf(user.role) > rankOf(req.user.role)) {
      throw createError.forbidden(`You cannot modify a ${user.role} account`);
    }
    if (status !== 'active') await assertNotLastFullAdmin(user, 'user');
  }

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';

  const previousStatus = user.status;
  user.status = status;
  await user.save();

  // Audit log (record the reason so a ban is never a mystery later).
  logAudit('user_status_changed', req.user.id, {
    targetUserId: userId,
    previousStatus,
    newStatus: status,
    reason: reason || undefined,
  });

  // Tell the member when their account is restricted or restored — a ban that
  // just silently locks them out, with no reason, is the failure to avoid
  // (matches the photo-removal / verification-rejection notify pattern).
  if (user.role === 'user' && status !== previousStatus) {
    // A failed notification must never fail an otherwise-complete status change.
    try {
      // 'system' is the valid catch-all Notification type (the enum has no
      // dedicated account-status value; a bespoke type would need a migration).
      if (status === 'banned') {
        await notify(
          userId,
          'system',
          'Your account has been suspended',
          `Your TricityMatch account has been suspended${reason ? ` for the following reason: ${reason}` : ' for violating our community guidelines'}. If you believe this is a mistake, you can appeal from the sign-in page.`,
        );
      } else if (status === 'active' && previousStatus === 'banned') {
        await notify(
          userId,
          'system',
          'Your account has been restored',
          'Your TricityMatch account is active again. Welcome back.',
        );
      }
    } catch { /* notification is best-effort */ }
  }

  // The same news by email: only to a verified address (an unverified one may
  // not be theirs), and only to members. A member with only a phone number gets
  // the in-app notice alone; the response says so, so staff can call them.
  const suspended = status === 'banned';
  const restored = status === 'active' && previousStatus === 'banned';
  let memberEmail = 'not_needed';
  if (user.role === 'user' && status !== previousStatus && (suspended || restored)) {
    memberEmail = user.emailVerified === true && user.email
      ? (await mailAccountStatus(user, suspended, reason) ? 'sent' : 'failed')
      : 'no_verified_email';
  }

  res.json({
    success: true,
    memberEmailed: memberEmail === 'sent',
    // 'sent' | 'failed' | 'no_verified_email' | 'not_needed', for the admin's message.
    memberEmail,
    message: 'User status updated',
    user
  });
});

// @route   PUT /api/admin/users/:userId/identity
// @desc    Correct a member's date of birth and/or gender (locked to members once
//          onboarding completes). Support-only, reason required, audited, and the
//          new pair must still satisfy the marriageable-age rule.
// @access  Private/Admin (scope: users)
exports.changeMemberIdentity = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { dateOfBirth, gender, reason } = req.body;

  if (dateOfBirth === undefined && gender === undefined) {
    throw createError.badRequest('Provide dateOfBirth and/or gender');
  }
  if (typeof reason !== 'string' || reason.trim().length < 10) {
    throw createError.badRequest('A reason of at least 10 characters is required for the audit trail');
  }

  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) throw createError.notFound('Profile not found');

  const previous = { dateOfBirth: profile.dateOfBirth, gender: profile.gender };
  const nextGender = gender !== undefined ? gender : profile.gender;
  const nextDob = dateOfBirth !== undefined ? dateOfBirth : profile.dateOfBirth;
  if (gender !== undefined && !['male', 'female', 'other'].includes(gender)) {
    throw createError.badRequest('Invalid gender');
  }
  const problem = marriageableAgeProblem(nextGender, nextDob, new Date(), { who: 'The member' });
  if (problem) throw createError.badRequest(problem);

  if (gender !== undefined) profile.gender = gender;
  if (dateOfBirth !== undefined) profile.dateOfBirth = new Date(dateOfBirth);
  await profile.save();

  logAudit('member_identity_changed', req.user.id, {
    targetUserId: userId,
    reason: reason.trim(),
    previous,
    next: { dateOfBirth: profile.dateOfBirth, gender: profile.gender },
  });

  res.json({ success: true, message: 'Member identity updated', profile: { gender: profile.gender, dateOfBirth: profile.dateOfBirth } });
});

// @route   GET /api/admin/verifications
// @desc    Get pending verifications
// @access  Private/Admin
exports.getVerifications = asyncHandler(async (req, res) => {
  const rawStatus = req.query.status;
  // The page offers tabs for every status including `flagged` and `all`; the
  // allowlist stopped at three, so both of those tabs silently showed the
  // pending queue and a flagged verification vanished from every list.
  // No `status` param still means the pending queue (what existing callers get).
  const VALID_VERIFICATION_STATUSES = ['pending', 'approved', 'rejected', 'flagged'];
  const status = rawStatus && VALID_VERIFICATION_STATUSES.includes(rawStatus) ? rawStatus : 'pending';
  const statusWhere = rawStatus === 'all' ? {} : { status };
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
  const offset = (page - 1) * limit;

  const { count, rows: verifications } = await Verification.findAndCountAll({
    where: statusWhere,
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

  // A reviewer cannot rule on their own selfie. Otherwise anyone holding the
  // `verifications` scope could badge themselves.
  if (verification.userId === req.user.id) {
    throw createError.forbidden('You cannot review your own verification');
  }

  // Approval vouches for the profile as it is NOW: record what was compared, so a
  // later photo or name change withdraws the badge (utils/verificationFingerprint).
  let approvedFingerprint = null;
  if (status === 'approved') {
    const memberProfile = await Profile.findOne({
      where: { userId: verification.userId },
      attributes: ['profilePhoto', 'firstName', 'lastName', 'dateOfBirth', 'gender'],
    });
    if (!memberProfile?.profilePhoto) {
      throw createError.badRequest('This member has no profile photo to compare the selfie with');
    }
    approvedFingerprint = fingerprintOf(memberProfile);
  }

  const previousStatus = verification.status;
  verification.status = status;
  verification.adminNotes = safeAdminNotes;
  // verifiedAt/verifiedBy record WHEN and BY WHOM the decision was made, for any
  // decision (the moderation-safety stats read them that way). Member-facing
  // output only reports verifiedAt for an approved verification.
  verification.verifiedAt = new Date();
  verification.verifiedBy = req.user.id;
  verification.approvedFingerprint = approvedFingerprint;
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
  // This route sits behind the `users` scope, but half of what it returns is
  // money. A support sub-admin saw revenue and plan mix that /admin/revenue
  // refuses them with a 403, so the figures are only computed and returned for
  // a holder of the `revenue` scope.
  const canSeeRevenue = hasScope(req.user, 'revenue');
  const { Appeal } = require('../models');
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  // "Today" and the signups chart run on India days, so launch night
  // (00:00–05:30 IST) counts as the launch date, not the day before.
  const todayStart = istTodayStart(now);
  const chartFirstDay = istYmd(new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000));
  const openReport = { status: { [Op.in]: ['pending', 'reviewing'] } };

  const [
    totalUsers,
    verifiedUsers,
    members,
    revenueThisMonth,
    pendingVerifications,
    openReports,
    registrations,
    monthlyRevenue,
    planDistribution,
    unreadSupport,
    foundingGranted,
    profilesWithoutPhoto,
    photoVerifiedUsers,
    urgentOpenReports,
    pendingAppeals,
    oldestUnreadSupportAt,
    signupsToday,
    paymentsToday,
  ] = await Promise.all([
    // Total non-admin users
    User.count({ where: { role: 'user' } }),

    // Email-verified users
    User.count({ where: { role: 'user', emailVerified: true } }),

    // Members on a live premium plan, each counted once, split by how they got
    // it. Counting rows said 9 "paying" when 7 had paid: a staff grant carries
    // the list price but no payment, and one member can hold two live rows.
    // "Paying" is the one revenue predicate (utils/paidRevenue). Erased members
    // keep their rows as records; they are not subscribers any more.
    sequelize.query(
      `SELECT COUNT(*)::int AS premium,
              (COUNT(*) FILTER (WHERE paid))::int AS paying,
              (COUNT(*) FILTER (WHERE NOT paid AND founding))::int AS founding,
              (COUNT(*) FILTER (WHERE NOT paid AND NOT founding AND granted))::int AS granted
         FROM (
           SELECT s."userId",
                  BOOL_OR(${PAID_SUBSCRIPTION_SQL}) AS paid,
                  BOOL_OR(s."planType" = :foundingPlan) AS founding,
                  BOOL_OR(s."razorpayPaymentId" IS NULL AND s."planType" <> :foundingPlan) AS granted
             FROM "Subscriptions" s
             JOIN "Users" u ON u.id = s."userId"
            WHERE s.status = 'active'
              AND s."planType" IN (:paidPlans)
              AND (s."endDate" IS NULL OR s."endDate" > :now)
              AND u.status <> 'deleted'
            GROUP BY s."userId"
         ) live`,
      { replacements: { now, paidPlans: PAID_PLANS, foundingPlan: FOUNDING_PLAN }, type: sequelize.QueryTypes.SELECT }
    ).then(([row]) => row || { premium: 0, paying: 0, founding: 0, granted: 0 }),

    // Revenue collected this calendar month. "Collected" means a real payment
    // reference exists: an admin grant is written with the plan's list price
    // and no payment id, so summing on amount alone reported comped plans as
    // money that was never taken. razorpayPaymentId also carries the Google
    // Play purchase token, so store purchases still count.
    // Net of refunds: a partly refunded plan only counts what was kept.
    canSeeRevenue
      ? Subscription.findOne({
        attributes: [[sequelize.literal('COALESCE(SUM("amount" - "refundedAmount"), 0)'), 'total']],
        where: {
          ...PAID_SUBSCRIPTION_WHERE,
          createdAt: { [Op.gte]: startOfMonth },
        },
        raw: true,
      }).then((row) => Number(row?.total) || 0)
      : Promise.resolve(null),

    // Pending verification requests
    Verification.count({ where: { status: 'pending' } }),

    // Open reports: waiting AND being looked at. Counting only `pending` let a
    // report drop off the dashboard the moment someone opened it.
    Report.count({ where: openReport }),

    // Daily registrations for the last 30 India days. generate_series + LEFT
    // JOIN so a day with no signups is a 0 point, not a missing one (the chart
    // used to join the gaps and overstate the trend).
    sequelize.query(
      `WITH days AS (
         SELECT generate_series(CAST(:firstDay AS timestamp), CAST(:lastDay AS timestamp), interval '1 day')::date AS day
       ), joined AS (
         SELECT ("createdAt" AT TIME ZONE 'Asia/Kolkata')::date AS day, COUNT(*)::int AS n
           FROM "Users"
          WHERE role = 'user' AND "createdAt" >= :since
          GROUP BY 1
       )
       SELECT TO_CHAR(days.day, 'FMDD Mon') AS date, COALESCE(joined.n, 0)::int AS count
         FROM days LEFT JOIN joined ON joined.day = days.day
        ORDER BY days.day ASC`,
      {
        replacements: { firstDay: chartFirstDay, lastDay: istYmd(now), since: istDayStart(chartFirstDay) },
        type: sequelize.QueryTypes.SELECT,
      }
    ),

    // Monthly revenue for last 6 months
    !canSeeRevenue ? Promise.resolve([]) : sequelize.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YY') AS month,
              SUM(amount - "refundedAmount")::float AS amount
       FROM "Subscriptions"
       WHERE "createdAt" >= :sixMonthsAgo
         AND ${PAID_SUBSCRIPTION_SQL}
       GROUP BY DATE_TRUNC('month', "createdAt")
       ORDER BY DATE_TRUNC('month', "createdAt") ASC`,
      { replacements: { sixMonthsAgo }, type: sequelize.QueryTypes.SELECT }
    ),

    // Subscription plan distribution
    // Same predicate as the "active subscribers" tile above: a row that is still
    // flagged active but past its end date (the daily sweep has not run) or that
    // belongs to an erased member is not a live plan, and the chart used to count
    // both, so it disagreed with the tile beside it.
    !canSeeRevenue ? Promise.resolve([]) : sequelize.query(
      `SELECT s."planType" AS "planType", COUNT(*)::int AS count
         FROM "Subscriptions" s
         JOIN "Users" u ON u.id = s."userId"
        WHERE s.status = 'active'
          AND (s."endDate" IS NULL OR s."endDate" > :now)
          AND u.status <> 'deleted'
        GROUP BY s."planType"`,
      { replacements: { now }, type: sequelize.QueryTypes.SELECT }
    ),

    // Unread support enquiries. The inbox had no badge anywhere, so a message
    // could sit unanswered indefinitely unless somebody thought to look.
    ContactMessage.count({ where: { status: 'new' } }),

    // Founding grants issued against the cap. The window is time-boxed AND
    // capped, and neither figure surfaced anywhere until it was already spent.
    Subscription.count({ where: { planType: FOUNDING_PLAN } }),

    // Active members with no photograph — the strongest predictor of a member
    // who gets nowhere. The same predicate as the list the tile opens
    // (/admin/users?hasPhoto=no&role=user&status=active), so the two agree:
    // staff, erased accounts and paused ones are not in it.
    User.count({
      where: {
        role: 'user',
        status: 'active',
        [Op.and]: [sequelize.literal(`"User"."id" NOT IN (SELECT "userId" FROM "Profiles" WHERE COALESCE(array_length(photos, 1), 0) > 0)`)],
      },
    }),

    // The product's verified badge is an APPROVED photo verification, not a
    // verified email — count members who actually hold it.
    Verification.count({ where: { status: 'approved' }, distinct: true, col: 'userId' }),

    // Threats, underage and scam reports still open.
    Report.count({ where: { ...openReport, priority: 'urgent' } }),

    // Suspended members waiting for an answer to their appeal.
    Appeal.count({ where: { status: 'pending' } }),

    // How long the longest-waiting enquiry has sat unread.
    ContactMessage.min('createdAt', { where: { status: 'new' } }),

    // Members who joined today (India day).
    User.count({ where: { role: 'user', createdAt: { [Op.gte]: todayStart } } }),

    // Payments taken today (India day): the revenue predicate, dated by when
    // the plan started, which is when the payment was confirmed.
    canSeeRevenue
      ? sequelize.query(
        `SELECT COUNT(*)::int AS n FROM "Subscriptions"
          WHERE ${PAID_SUBSCRIPTION_SQL} AND COALESCE("startDate", "createdAt") >= :todayStart`,
        { replacements: { todayStart }, type: sequelize.QueryTypes.SELECT }
      ).then(([row]) => row?.n || 0)
      : Promise.resolve(null),
  ]);

  res.json({
    success: true,
    stats: {
      totalUsers,
      // Photo-verified (approved verification). `verifiedUsers` kept as the key
      // the dashboard already reads; the old email-verified count is below.
      verifiedUsers: photoVerifiedUsers,
      emailVerifiedUsers: verifiedUsers,
      // Members on a live premium plan, however they got it.
      activeSubscribers: members.premium,
      // ...of whom: bought it, hold a founding place, or were given it by staff.
      paidSubscribers: members.paying,
      foundingActive: members.founding,
      staffGrantedActive: members.granted,
      // null = this admin lacks the revenue scope (not "zero revenue").
      revenueThisMonth: canSeeRevenue ? (revenueThisMonth || 0) : null,
      pendingVerifications,
      openReports,
      urgentOpenReports,
      pendingAppeals,
      unreadSupport,
      oldestUnreadSupportAt: oldestUnreadSupportAt || null,
      signupsToday,
      // A count of payments is money information too: null without `revenue`.
      paymentsToday,
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

const OPEN_REPORT_STATUSES = ['pending', 'reviewing'];

/**
 * How often each reported member on a page of reports has been reported, so a
 * reviewer sees a pattern without opening every case: `otherReports` counts the
 * other reports against the same member (any status), `otherOpenReports` the
 * ones still waiting. One grouped query for the whole page. Also swaps the raw
 * hidden timestamp for a plain `invisible` flag.
 */
const attachReportHistory = async (reports) => {
  for (const r of reports) {
    const member = r.ReportedUser;
    if (member) {
      member.dataValues.invisible = Boolean(member.dataValues.hiddenAt);
      delete member.dataValues.hiddenAt;
    }
  }
  const ids = [...new Set(reports.map((r) => r.reportedUserId).filter(Boolean))];
  if (!ids.length) return;
  const rows = await sequelize.query(
    `SELECT "reportedUserId",
            count(*)::int AS total,
            (count(*) FILTER (WHERE status IN ('pending', 'reviewing')))::int AS open
       FROM "Reports"
      WHERE "reportedUserId" IN (:ids)
      GROUP BY "reportedUserId"`,
    { replacements: { ids }, type: sequelize.QueryTypes.SELECT }
  );
  const byMember = new Map(rows.map((row) => [row.reportedUserId, row]));
  for (const r of reports) {
    const counts = byMember.get(r.reportedUserId) || { total: 1, open: 0 };
    const thisOneOpen = OPEN_REPORT_STATUSES.includes(r.status) ? 1 : 0;
    r.dataValues.otherReports = Math.max(0, counts.total - 1);
    r.dataValues.otherOpenReports = Math.max(0, counts.open - thisOneOpen);
  }
};

// @route   GET /api/admin/reports
// @desc    Get user reports with optional status filter
// @access  Private/Admin
exports.getReports = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const { status } = req.query;
  // Every status the workflow can write. The allowlist used to stop at
  // pending/reviewed/dismissed, so the queue's Reviewing and Resolved tabs
  // silently returned everything.
  const VALID_REPORT_STATUSES = ['pending', 'reviewing', 'reviewed', 'resolved', 'dismissed'];
  const where = {};
  // `open` = everything still waiting on a decision (pending or being reviewed),
  // the same set the dashboard counts as open.
  if (status === 'open') where.status = { [Op.in]: OPEN_REPORT_STATUSES };
  else if (status && VALID_REPORT_STATUSES.includes(status)) where.status = status;
  if (['urgent', 'normal'].includes(req.query.priority)) where.priority = req.query.priority;

  // Free-text search over the reason and either party's name / email / phone.
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  if (search) {
    const like = { [Op.iLike]: `%${escapeLikePattern(search)}%` };
    where[Op.or] = [
      sequelize.where(sequelize.cast(sequelize.col('Report.reason'), 'text'), like),
      { '$Reporter.email$': like },
      { '$ReportedUser.email$': like },
      { '$Reporter.phone$': like },
      { '$ReportedUser.phone$': like },
      { '$Reporter.Profile.firstName$': like },
      { '$Reporter.Profile.lastName$': like },
      { '$ReportedUser.Profile.firstName$': like },
      { '$ReportedUser.Profile.lastName$': like },
    ];
  }

  // Open work is oldest-first (whoever has waited longest is next); finished
  // reports are newest-first. Urgent always leads.
  const openQueue = status === 'open' || status === 'pending' || status === 'reviewing';
  const { count, rows: reports } = await Report.findAndCountAll({
    where,
    distinct: true,
    include: [
      {
        model: User,
        as: 'Assignee',
        attributes: ['id', 'email'],
        required: false,
        include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
      },
      {
        model: User,
        as: 'Reporter',
        attributes: ['id', 'email', 'phone'],
        include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
      },
      {
        model: User,
        as: 'ReportedUser',
        // status / role / hiddenAt so the reviewer can see whether the member
        // is already banned or hidden, and is offered only the actions that apply.
        attributes: ['id', 'email', 'phone', 'role', 'status', 'hiddenAt'],
        include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
      },
    ],
    // 'urgent' sorts after 'normal', so DESC puts urgent reports first.
    order: [['priority', 'DESC'], ['createdAt', openQueue ? 'ASC' : 'DESC']],
    limit,
    offset,
  });

  await attachReportHistory(reports);

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
  const { status, adminNotes, assignToMe } = req.body;

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
  // Owner of the case: whoever picks it up (or asks to) holds it until someone
  // else does — a queue with no owner is a queue where everyone assumes another
  // person has it.
  if (assignToMe || status === 'reviewing') report.assignedTo = req.user.id;
  await report.save();

  logAudit('report_status_changed', req.user.id, { reportId, previous, status });

  // Notify reporter of the outcome
  const outcomeCopy = {
    reviewing: 'is being reviewed by our team',
    resolved: 'has been reviewed and action has been taken',
    reviewed: 'has been reviewed and action has been taken',
    dismissed: 'has been reviewed and dismissed',
  };
  // A system-filed review (underage sweep) has an admin as its stand-in reporter;
  // that admin did not report anything and must not get a notice for each case.
  if (!isSystemReview(report)) {
    await notify(
      report.reporterId,
      'report_reviewed',
      'Your report has been updated',
      `Your report ${outcomeCopy[status] || 'has been reviewed'}.`
    );
  }

  res.json({ success: true, report });
});

// @route   POST /api/admin/users
// @desc    Create a new user (admin-side)
// @access  Private/Admin
exports.createUser = asyncHandler(async (req, res) => {
  const { email, password, phone, firstName, lastName, gender, dateOfBirth, status = 'active' } = req.body;
  // Role must always default to 'user' — never trust the request body for role assignment.
  // Admin can promote users via a separate, explicit admin action if needed.
  const role = 'user';

  if (!email || !password || !firstName || !lastName) {
    throw createError.badRequest('email, password, firstName, and lastName are required');
  }
  if (!['male', 'female'].includes(gender)) throw createError.badRequest('Choose the member\'s gender');
  const ageProblem = dateOfBirth ? marriageableAgeProblem(gender, dateOfBirth, new Date(), { who: 'The member' }) : 'Enter the member\'s date of birth';
  if (ageProblem) throw createError.badRequest(ageProblem);

  // Validate status to only allowed values (never allow 'banned' on creation)
  const allowedStatuses = ['active', 'pending', 'inactive'];
  const safeStatus = allowedStatuses.includes(status) ? status : 'active';

  // Same canonical form as signup and login, so an address typed with mixed
  // case is findable at sign-in; the duplicate check covers the legacy
  // dot-stripped form older signups stored.
  const normalisedEmail = canonicalEmail(email) || String(email).trim().toLowerCase();
  const existing = await User.findOne({ where: { email: { [Op.in]: emailLookupCandidates(normalisedEmail) } }, attributes: ['id'] });
  if (existing) throw createError.conflict('User already exists with this email');
  const phoneValue = cleanPhone(phone);
  await assertPhoneFree(phoneValue);

  const result = await sequelize.transaction(async (t) => {
    const user = await User.create({
      email: normalisedEmail,
      password,
      phone: phoneValue,
      role,
      status: safeStatus,
      emailVerified: true,
      // The member accepts the Terms themselves at first sign-in.
      termsVersion: ASSISTED_SIGNUP_TERMS,
    }, { transaction: t });

    await Profile.create({
      userId: user.id,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      gender,
      dateOfBirth,
      // The admin collected what self-signup's basics step collects, so the
      // account is onboarded like one (and the verified-number check applies).
      onboardingComplete: true,
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
    // What support is asked about on each row: when the money arrived (the
    // plan starts the moment the payment is confirmed), which rail took it, and
    // when it was last refunded. The gateway ids, refund totals and dispute
    // state are the row's own columns.
    for (const s of subscriptions) {
      const paid = Boolean(s.razorpayPaymentId);
      const refundTimes = (Array.isArray(s.refunds) ? s.refunds : []).map((r) => r && r.at).filter(Boolean).sort();
      s.dataValues.paidAt = paid ? (s.startDate || s.createdAt) : null;
      s.dataValues.paymentRail = !paid ? null : (s.razorpaySignature === 'GOOGLE_PLAY' ? 'google_play' : 'razorpay');
      s.dataValues.lastRefundAt = refundTimes.length ? refundTimes[refundTimes.length - 1] : (s.refundedAt || null);
    }
    user.dataValues.Subscriptions = subscriptions;
  }

  if (!user) throw createError.notFound('User not found');

  await attachActivePlans([user]);

  // Reports received by this user. What the reporter wrote goes only to staff
  // who can work the report queue, where the same text is shown anyway.
  const reports = await Report.findAll({
    where: { reportedUserId: userId },
    limit: 10,
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'reason', 'status', 'priority', 'createdAt', ...(hasScope(req.user, 'reports') ? ['description'] : [])],
  });

  // Invisible-to-members state for the admin banner (User.toJSON strips the
  // raw columns so a member never receives them). The admin's email, because
  // an id means nothing to the next admin reading the record.
  if (user.hiddenAt) {
    const by = user.hiddenBy ? await User.findByPk(user.hiddenBy, { attributes: ['email'] }) : null;
    user.dataValues.invisible = { since: user.hiddenAt, reason: user.hiddenReason, byEmail: by?.email || null };
  } else {
    user.dataValues.invisible = null;
  }

  // Which partner this member is credited to, if any. First touch wins and
  // credit never moves, so there is at most one converted lead per member;
  // the oldest is the one that counts if old data holds more.
  const creditLead = await MarketingLead.findOne({
    where: { convertedUserId: userId },
    include: [{
      model: User,
      as: 'AssignedMarketer',
      attributes: ['id', 'email', 'status', 'role'],
      include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }],
    }],
    order: [['createdAt', 'ASC']],
  });
  user.dataValues.partnerCredit = creditLead ? {
    leadId: creditLead.id,
    partnerId: creditLead.assignedToMarketingUserId,
    partnerName: partnerName(creditLead.AssignedMarketer),
    partnerEmail: creditLead.AssignedMarketer?.email || null,
    partnerStatus: creditLead.AssignedMarketer?.status || null,
    referralCode: creditLead.referralCode || null,
    campaign: creditLead.campaign || null,
    addedAt: creditLead.createdAt,
  } : null;

  // Opening a member's full record is itself a privileged read.
  auditViewOnce('member_record_viewed', req.user.id, userId);

  res.json({ success: true, user, reports });
});

// @route   GET /api/v1/admin/users/:userId/moderation-history
// @desc    Reports, photo holds, appeals and staff actions for one member
// @access  Private/Admin (scope: reports)
exports.getModerationHistory = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const exists = await User.count({ where: { id: userId } });
  if (!exists) throw createError.notFound('User not found');
  const history = await buildModerationHistory(userId);
  auditViewOnce('moderation_history_viewed', req.user.id, userId);
  res.json({ success: true, ...history });
});

// @route   PUT /api/admin/users/:userId/subscription
// @desc    Manually override a user's subscription (bypass Razorpay)
// @access  Private/Admin
exports.updateSubscription = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { planType, startDate, endDate, status = 'active' } = req.body;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';

  if (!ALL_PLANS.includes(planType)) {
    throw createError.badRequest(`planType must be one of: ${ALL_PLANS.join(', ')}`);
  }
  // An override either grants the plan now or parks it; anything else ('expired',
  // 'cancelled', junk) used to reach the INSERT after the member's real plan had
  // already been cancelled, 500ing and leaving them with nothing.
  if (!['active', 'pending'].includes(status)) {
    throw createError.badRequest('status must be active or pending');
  }

  const parseDate = (value, field) => {
    if (value === undefined || value === null || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw createError.badRequest(`${field} is not a valid date`);
    return d;
  };
  const startAt = parseDate(startDate, 'startDate');
  const explicitEnd = parseDate(endDate, 'endDate');

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

  const { getPlanDetails } = require('../utils/razorpay');
  const planDetails = getPlanDetails(planType);
  const isFree = planType === 'free';
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
  const grantStart = startAt || new Date();
  const subEndDate = explicitEnd
    ? explicitEnd
    : isFounding && foundingState.endsAt
      ? new Date(foundingState.endsAt)
      : planDetails ? termEndDate(grantStart, planDetails) : planEndDate(grantStart, grantDays);

  if (!isFree) {
    if (subEndDate <= grantStart) throw createError.badRequest('endDate must be after startDate');
    // A hand-typed end date is the one number here nothing else bounds. Allow
    // the plan's own term plus a generous extension, not an open-ended grant.
    const maxMs = (grantDays + 365) * 24 * 60 * 60 * 1000;
    if (subEndDate.getTime() - grantStart.getTime() > maxMs) {
      throw createError.badRequest('endDate is too far in the future for this plan');
    }
  }

  // Everything below is one unit. The cancel used to commit first and the
  // create after, so any failure in between left a paying member on nothing.
  const outcome = await sequelize.transaction(async (t) => {
    const liveNow = await Subscription.findAll({
      where: { userId, status: 'active' },
      order: [['createdAt', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const current = liveNow.find((s) => !s.endDate || new Date(s.endDate) > new Date()) || null;

    // Re-granting the plan the member already holds with no new term changes
    // nothing except resetting their used unlocks to 0 — a free re-grant.
    if (!isFree && current && current.planType === planType && !explicitEnd && !startAt) {
      throw createError.conflict(
        'This member is already on that plan. Choose a different plan, or set an end date to change the term.'
      );
    }

    const hadUnlimited = liveNow.some((s) => UNLIMITED_PLANS.includes(s.planType));

    if (liveNow.length) {
      await Subscription.update(
        { status: 'cancelled' },
        { where: { userId, status: 'active' }, transaction: t }
      );
    }

    // "Free" is the absence of a plan: no row. An active planType 'free' row
    // used to be inserted with a 30-day term and showed up as a plan in the
    // dashboard distribution.
    let created = null;
    if (!isFree) {
      created = await Subscription.create({
        userId,
        planType,
        status,
        startDate: grantStart,
        endDate: subEndDate,
        amount: planDetails ? planDetails.amount / 100 : 0,
        contactUnlocksAllowed: isFounding
          ? (foundingState.contactUnlocks ?? FOUNDING_CONTACT_UNLOCKS)
          : (planDetails ? planDetails.contactUnlocks : null),
        contactUnlocksUsed: 0,
      }, { transaction: t });
    }

    // Boost follows the plan that is now live: set for an active unlimited
    // grant, withdrawn when an unlimited plan was replaced by anything else
    // (the cancel route already did this; the override left it on forever).
    if (created && UNLIMITED_PLANS.includes(planType) && status === 'active') {
      await User.update(
        { isBoosted: true, boostExpiresAt: subEndDate },
        { where: { id: userId }, transaction: t }
      );
    } else if (hadUnlimited) {
      await User.update(
        { isBoosted: false, boostExpiresAt: null },
        { where: { id: userId }, transaction: t }
      );
    }

    // Founding-ness is a User fact that outlives the row (upgrade supersedes it,
    // the cohort expires together), so stamp it here as the grant util does.
    if (created && isFounding && status === 'active') {
      await User.update({ isFoundingMember: true }, { where: { id: userId }, transaction: t });
    }

    return { created, previous: current };
  });

  logAudit('subscription_overridden', req.user.id, {
    userId,
    planType,
    status,
    reason: reason || null,
    previous: outcome.previous
      ? {
          planType: outcome.previous.planType,
          endDate: outcome.previous.endDate,
          contactUnlocksUsed: outcome.previous.contactUnlocksUsed,
          contactUnlocksAllowed: outcome.previous.contactUnlocksAllowed,
        }
      : null,
  });

  // The member reads this: the plan's name, not the enum key.
  const label = isFree ? 'Free' : isFounding ? 'Founding Premium' : (planDetails?.name || planType);
  await notify(
    userId,
    'system',
    'Subscription updated',
    isFree
      ? 'Your paid plan has been ended by our team. Your profile and matches are unchanged.'
      : `Your membership has been updated to ${label} by our team.`
  );

  res.json({
    success: true,
    message: 'Subscription updated',
    subscription: outcome.created,
  });
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

// @route   GET /api/v1/admin/users/export
// @desc    Download the (filtered) member list as CSV
// @access  Private/Admin (scope: users)
//
// Streamed in batches, so there is no row cap: the file is as long as the list
// is. It used to stop at 5,000 rows with nothing to say rows were missing.
// `X-Total-Rows` tells the client how many to expect, and a failure part-way is
// marked inside the file rather than leaving a short file that looks complete.
const EXPORT_BATCH = 1000;
// Test seam: lets a test export across several batches without creating 1,000+ rows.
const exportBatchSize = () => exports.__exportBatchForTests || EXPORT_BATCH;

exports.exportUsers = asyncHandler(async (req, res) => {
  const baseWhere = buildUserWhere(req.query);
  const total = await User.count({ where: baseWhere });
  const { toProfileCode } = require('../utils/profileCode');
  // India dates, like every other admin screen: someone who joined at 00:30 IST
  // on the 11th joined on the 11th, not the 10th.
  const ymd = (d) => (d ? istYmd(d) : '');

  const header = [
    'Name', 'Email', 'Phone', 'City', 'Gender', 'Role', 'Status', 'Plan', 'Has photo', 'Joined',
    // Appended after the original columns so a saved spreadsheet layout still lines up.
    'Last active', 'Email verified', 'Phone verified', 'Profile code', 'Member ID',
    'Hidden from members',
  ];

  const result = await streamCsv(res, {
    filename: `tricitymatch-members-${istYmd()}.csv`,
    header,
    total,
    log,
    // Keyset paging on (createdAt DESC, id DESC): each batch costs the same on a
    // large table and the export stays consistent if members join while it runs.
    fetchBatch: async (cursor) => {
      const and = [baseWhere];
      if (cursor) {
        and.push({
          [Op.or]: [
            { createdAt: { [Op.lt]: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { [Op.lt]: cursor.id } },
          ],
        });
      }
      const rows = await User.findAll({
        where: { [Op.and]: and },
        include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city', 'gender', 'dateOfBirth', 'photos'] }],
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: exportBatchSize(),
      });
      await attachActivePlans(rows);
      const last = rows[rows.length - 1];
      return {
        rows,
        next: rows.length === exportBatchSize() ? { createdAt: last.createdAt, id: last.id } : null,
      };
    },
    toRow: (user) => {
      const p = user.Profile;
      return [
        [p?.firstName, p?.lastName].filter(Boolean).join(' '),
        user.email,
        user.phone,
        p?.city,
        p?.gender,
        user.role,
        user.status,
        user.dataValues.activePlan,
        Array.isArray(p?.photos) && p.photos.length > 0 ? 'yes' : 'no',
        ymd(user.createdAt),
        ymd(user.lastLogin),
        user.emailVerified ? 'yes' : 'no',
        user.phoneVerified ? 'yes' : 'no',
        toProfileCode(user.id),
        user.id,
        user.hiddenAt ? `yes (${ymd(user.hiddenAt)})` : 'no',
      ];
    },
  });

  // The filters used are recorded as names only, never the search text (which
  // can be an email or phone number).
  logAudit('users_exported', req.user.id, {
    rows: result.rows,
    expected: total,
    complete: !result.aborted && result.rows === total,
    filters: Object.keys(req.query || {}).filter((k) => req.query[k] !== '' && k !== 'format'),
  });
});

// ---- moving leads between partners -----------------------------------------

const leadReassignResponse = (r) => ({
  moved: r.moved,
  skippedConverted: r.skippedConverted,
  skippedDuplicate: r.skippedDuplicate,
  skippedSame: r.skippedSame,
});

const leadReassignMessage = (r) => {
  if (r.moved === 0 && r.requested === 0) return 'There were no open leads to move';
  const bits = [`Moved ${r.moved} lead${r.moved === 1 ? '' : 's'}`];
  if (r.skippedDuplicate) bits.push(`${r.skippedDuplicate} skipped (the new partner already has them)`);
  if (r.skippedConverted) bits.push(`${r.skippedConverted} skipped (already became members, so they stay with their partner)`);
  if (r.skippedSame) bits.push(`${r.skippedSame} already theirs`);
  return `${bits.join('; ')}.`;
};

// @route   PUT /api/v1/admin/leads/:leadId/assign
// @desc    Move one lead to another active partner
// @access  Private/Admin (scope: marketing)
exports.assignLead = asyncHandler(async (req, res) => {
  const lead = await MarketingLead.findByPk(req.params.leadId, { attributes: ['id', 'assignedToMarketingUserId'] });
  if (!lead) throw createError.notFound('Lead not found');
  try {
    const r = await reassignLeads({ toUserId: req.body?.marketingUserId, leadIds: [lead.id] });
    if (r.skippedConverted) throw createError.conflict('This lead has already become a member, so it stays with the partner who earned it');
    if (r.skippedDuplicate) throw createError.conflict('That partner already has this person in their list');
    if (r.skippedSame) throw createError.badRequest('This lead already belongs to that partner');
    logAudit('lead_reassigned', req.user.id, {
      targetUserId: req.body.marketingUserId,
      leadId: lead.id,
      fromUserId: lead.assignedToMarketingUserId,
    });
    res.json({ success: true, message: leadReassignMessage(r), ...leadReassignResponse(r) });
  } catch (err) {
    if (err instanceof LeadReassignError) throw err.statusCode === 404 ? createError.notFound(err.message) : createError.badRequest(err.message);
    throw err;
  }
});

// @route   POST /api/v1/admin/marketing-users/:userId/reassign-leads
// @desc    Hand every OPEN lead of one partner to another active partner
//          (typically when the first is leaving or deactivated).
// @access  Private/Admin (scope: marketing)
exports.reassignPartnerLeads = asyncHandler(async (req, res) => {
  const from = await User.findByPk(req.params.userId, { attributes: ['id', 'role'] });
  if (!from || !['marketing', 'marketing_manager'].includes(from.role)) throw createError.notFound('Marketing user not found');
  if (req.body?.toUserId === from.id) throw createError.badRequest('Choose a different partner to move the leads to');
  try {
    const r = await reassignLeads({ fromUserId: from.id, toUserId: req.body?.toUserId });
    logAudit('leads_reassigned', req.user.id, {
      targetUserId: req.body.toUserId,
      fromUserId: from.id,
      moved: r.moved,
      skippedDuplicate: r.skippedDuplicate,
      skippedConverted: r.skippedConverted,
      leadIds: (r.movedIds || []).slice(0, 50),
    });
    res.json({ success: true, message: leadReassignMessage(r), ...leadReassignResponse(r) });
  } catch (err) {
    if (err instanceof LeadReassignError) throw err.statusCode === 404 ? createError.notFound(err.message) : createError.badRequest(err.message);
    throw err;
  }
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

  const phoneValue = cleanPhone(phone);
  await assertPhoneFree(phoneValue);

  const created = await sequelize.transaction(async (t) => {
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      phone: phoneValue,
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
       SUM(amount - "refundedAmount")::float AS revenue
     FROM "Subscriptions"
     WHERE amount > 0
       AND ${PAID_SUBSCRIPTION_SQL}
       AND "createdAt" >= NOW() - INTERVAL '12 months'
     GROUP BY DATE_TRUNC('month', "createdAt"), "planType"
     ORDER BY DATE_TRUNC('month', "createdAt") ASC`,
    { type: sequelize.constructor.QueryTypes.SELECT }
  );

  // All-time totals
  const [totals] = await sequelize.query(
    `SELECT
       COUNT(*)::int AS total_transactions,
       SUM(amount - "refundedAmount")::float AS total_revenue,
       AVG(amount - "refundedAmount")::float AS avg_transaction
     FROM "Subscriptions"
     WHERE amount > 0
       AND ${PAID_SUBSCRIPTION_SQL}`,
    { type: sequelize.constructor.QueryTypes.SELECT }
  );

  if (format === 'csv') {
    const csvSafe = csvCell;
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
  const blocked = invoiceBlocker(subscription);
  if (blocked) throw createError.badRequest(blocked);

  generateInvoicePDF(res, {
    subscription,
    user: subscription.User,
    profile: subscription.User?.Profile,
  });
});

// @route   POST /api/admin/subscriptions/:subscriptionId/refund
// @desc    Issue a manual Razorpay refund against a subscription's payment.
// @access  Private/Admin (scope: subscriptions)
//
// The self-service `DELETE /subscription/current` used to compute and fire a
// pro-rata refund automatically on every cancellation, which was more
// generous than the Refund & Conduct Policy we publish (seven-day full
// refund on request, nothing automatic after that). That auto-refund is
// gone; this is the replacement — a human reads the request against the
// policy and types the figure in. `amount` is REQUIRED and in rupees
// (deliberately not paise — a pricing surface that asks a human for paise is
// a mis-charge waiting to happen) and is never derived from the plan or the
// elapsed term.
exports.refundSubscription = asyncHandler(async (req, res) => {
  const { subscriptionId } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
  const amountRupees = Number(req.body?.amount);

  if (!config.razorpay.isConfigured()) {
    throw createError.internal('Payment gateway is not configured');
  }
  if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
    throw createError.badRequest('amount must be a positive number of rupees');
  }

  // A sub-admin may refund small amounts; anything larger needs a full admin.
  if (req.user.role === 'sub_admin' && amountRupees > SUB_ADMIN_REFUND_LIMIT_RUPEES) {
    throw createError.forbidden(`Refunds above ₹${SUB_ADMIN_REFUND_LIMIT_RUPEES} need a full admin`);
  }

  const subscription = await Subscription.findByPk(subscriptionId, {
    include: [{ model: User, attributes: ['id', 'email'] }],
  });
  if (!subscription) throw createError.notFound('Subscription not found');
  if (!subscription.razorpayPaymentId) {
    throw createError.badRequest('This subscription has no payment to refund (free or granted plan)');
  }
  if (subscription.razorpaySignature === 'GOOGLE_PLAY') {
    // razorpayPaymentId doubles as the Google Play purchase token for that
    // rail (see subscriptionController.verifyGooglePlay) — it is not a
    // Razorpay payment id and rzp.payments.refund would fail confusingly.
    throw createError.badRequest('This was a Google Play purchase — refund it from the Play Console, not here');
  }

  // Sanity cap, not the source of truth: an admin fat-fingering an extra
  // digit must not refund more than the member actually paid. Razorpay would
  // itself refuse an amount beyond what remains on the payment, but catching
  // the obvious mistake here gives a clear message instead of a gateway error.
  const paidRupees = parseFloat(subscription.amount) || 0;
  if (paidRupees > 0 && amountRupees > paidRupees) {
    throw createError.badRequest(`amount cannot exceed what was paid (₹${paidRupees})`);
  }

  const { getRazorpayInstance } = require('../utils/razorpay');
  const rzp = getRazorpayInstance();
  if (!rzp) {
    throw createError.internal('Payment gateway is not configured');
  }

  const amountPaise = Math.round(amountRupees * 100);

  let refund;
  try {
    refund = await rzp.payments.refund(subscription.razorpayPaymentId, {
      amount: amountPaise,
      notes: {
        reason: reason || 'admin_manual_refund',
        subscriptionId: subscription.id,
        adminId: req.user.id,
      },
    });
  } catch (err) {
    const description = err?.error?.description || err.message;
    log.error('Manual admin refund failed', { error: description, subscriptionId, adminId: req.user.id });
    throw createError.badRequest(`Refund failed: ${description}`);
  }

  // The record of who refunded what — there is no ledger column on
  // Subscription for this, and adding one is out of scope for a minimal
  // admin action; AuditLogs (migration 000060) is the durable record.
  logAudit('subscription_refunded_manual', req.user.id, {
    subscriptionId: subscription.id,
    userId: subscription.userId,
    amountPaise,
    reason,
    razorpayRefundId: refund.id,
  });

  // Record it on the subscription now (the webhook's refund.processed will find
  // it already recorded and do nothing). Best-effort: the refund has happened at
  // the gateway either way, and the webhook is the safety net if this fails.
  try {
    await recordRefund({
      paymentId: subscription.razorpayPaymentId,
      refundId: refund.id,
      amountPaise,
      source: 'admin',
    });
  } catch (err) {
    log.error('Could not record refund on the subscription', { error: err.message, subscriptionId: subscription.id });
  }

  if (subscription.User?.id) {
    await notify(
      subscription.User.id,
      'system',
      'Refund issued',
      `We've issued a refund of ₹${amountRupees.toFixed(2)} to your original payment method. It usually takes five to seven working days to appear, depending on your bank.`
    );
  }

  res.json({
    success: true,
    message: 'Refund issued',
    refund: { refundId: refund.id, amount: amountPaise / 100 },
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
  const { status, role, setup } = req.query;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const sort = ['newest', 'oldest', 'name', 'revenue', 'signedUp', 'paid', 'leads'].includes(req.query.sort) ? req.query.sort : 'newest';

  const and = [{ role: { [Op.in]: ['marketing', 'marketing_manager'] } }];
  if (['active', 'inactive'].includes(status)) and.push({ status });
  if (['marketing', 'marketing_manager'].includes(role)) and.push({ role });
  if (search) {
    const term = `%${escapeLikePattern(search)}%`;
    const digits = search.replace(/\D/g, '');
    const or = [
      { email: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
      sequelize.where(
        sequelize.fn('TRIM', sequelize.literal(`COALESCE("Profile"."firstName", '') || ' ' || COALESCE("Profile"."lastName", '')`)),
        { [Op.iLike]: term }
      ),
    ];
    if (digits.length >= 4 && digits !== search) or.push({ phone: { [Op.iLike]: `%${digits.slice(-10)}%` } });
    // A partner can be found by one of their codes too.
    or.push(sequelize.literal(`"User"."id" IN (SELECT "marketingUserId" FROM "ReferralCodes" WHERE code ILIKE ${sequelize.escape(term)})`));
    and.push({ [Op.or]: or });
  }

  // Partners are few (a few hundred at most), so every match is loaded, given
  // its numbers, sorted, then paged. That is what lets the list sort by
  // revenue or sign-ups rather than only by date joined.
  const MAX = 1000;
  const all = await User.findAll({
    where: { [Op.and]: and },
    include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city'], required: false }],
    order: [['createdAt', 'DESC']],
    limit: MAX,
  });

  const { getPartnerMetrics } = require('../utils/marketingTeam');
  const metrics = await getPartnerMetrics(all.map((u) => u.id));
  let rows = all.map((u) => {
    const m = metrics[u.id] || {};
    // `onboarding` keeps the shape the page already reads; `metrics` is new.
    return {
      ...u.toJSON(),
      onboarding: null,
      openLeads: m.openLeads || 0,
      metrics: {
        totalLeads: m.totalLeads || 0,
        signedUp: m.signedUp || 0,
        paidMembers: m.paidMembers || 0,
        revenue: m.revenue || 0,
        commissionRate: m.commissionRate ?? null,
        commissionEarned: m.commissionEarned || 0,
        activeCodes: m.activeCodes || 0,
      },
    };
  });
  const onboarding = await getOnboardingBatch(rows.map((r) => r.id));
  rows.forEach((r) => { r.onboarding = onboarding[r.id] || null; });

  if (setup === 'incomplete') rows = rows.filter((r) => r.onboarding && !r.onboarding.complete);
  if (setup === 'complete') rows = rows.filter((r) => r.onboarding && r.onboarding.complete);

  const nameOf = (r) => [r.Profile?.firstName, r.Profile?.lastName].filter(Boolean).join(' ').trim().toLowerCase() || r.email;
  const by = {
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
    revenue: (a, b) => b.metrics.revenue - a.metrics.revenue,
    signedUp: (a, b) => b.metrics.signedUp - a.metrics.signedUp,
    paid: (a, b) => b.metrics.paidMembers - a.metrics.paidMembers,
    leads: (a, b) => b.metrics.totalLeads - a.metrics.totalLeads,
  }[sort];
  rows.sort((a, b) => by(a, b) || (new Date(b.createdAt) - new Date(a.createdAt)));

  // Totals across every partner matching the filters, not just this page.
  const totals = rows.reduce((t, r) => ({
    partners: t.partners + 1,
    active: t.active + (r.status === 'active' ? 1 : 0),
    totalLeads: t.totalLeads + r.metrics.totalLeads,
    signedUp: t.signedUp + r.metrics.signedUp,
    paidMembers: t.paidMembers + r.metrics.paidMembers,
    revenue: t.revenue + r.metrics.revenue,
    commissionEarned: t.commissionEarned + r.metrics.commissionEarned,
  }), { partners: 0, active: 0, totalLeads: 0, signedUp: 0, paidMembers: 0, revenue: 0, commissionEarned: 0 });

  const count = rows.length;
  const offset = (page - 1) * limit;
  res.json({
    success: true,
    users: rows.slice(offset, offset + limit),
    totals,
    truncated: all.length === MAX,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.max(Math.ceil(count / limit), 1),
    },
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

  // Same canonical form as signup and login, so an address typed with mixed
  // case is findable at sign-in; the duplicate check covers the legacy
  // dot-stripped form older signups stored.
  const normalisedEmail = canonicalEmail(email) || String(email).trim().toLowerCase();
  const existing = await User.findOne({ where: { email: { [Op.in]: emailLookupCandidates(normalisedEmail) } }, attributes: ['id'] });
  if (existing) throw createError.conflict('User already exists with this email');
  const phoneValue = cleanPhone(phone);
  await assertPhoneFree(phoneValue);

  const result = await sequelize.transaction(async (t) => {
    const user = await User.create({
      email: normalisedEmail,
      password,
      phone: phoneValue,
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

  // Tell the partner what to do first. Best effort: the account exists either
  // way, and the admin is told if the mail did not go so they can follow up.
  // No password is ever included (the admin shares that separately).
  let welcomeEmailSent = false;
  try {
    const sent = await sendPartnerWelcome(user.email, firstName);
    welcomeEmailSent = Boolean(sent && sent.success !== false);
  } catch (err) {
    log.warn('Partner welcome email failed', { userId: user.id, error: err.message });
  }

  res.status(201).json({ success: true, message: 'Marketing user created', user, welcomeEmailSent });
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

  // A deactivated rep's codes must stop working everywhere, not only at login
  // and checkout: they went on creating leads and boosting new signups.
  // Reactivating deliberately does NOT switch codes back on — an admin may have
  // retired individual codes, and which ones to restore is their call.
  let codesDeactivated = 0;
  if (status === 'inactive') {
    [codesDeactivated] = await ReferralCode.update(
      { isActive: false },
      { where: { marketingUserId: userId, isActive: true } }
    );
  }

  logAudit('marketing_user_status_changed', req.user.id, {
    targetUserId: userId,
    previousStatus,
    newStatus: status,
    codesDeactivated,
  });

  res.json({ success: true, message: 'Marketing user status updated', user });
});

// @route   GET /api/admin/marketing-users/:userId/stats
// @desc    Get marketing user stats
// @access  Private/Admin
// @route   GET /api/v1/admin/marketing-commission
// @desc    Current commission rate (and any per-rep overrides)
// @access  Private/Admin (marketing scope)
exports.getMarketingCommission = asyncHandler(async (req, res) => {
  const settings = await getCommissionSettings();
  res.json({ success: true, commission: settings });
});

// @route   PUT /api/v1/admin/marketing-commission
// @desc    Set the commission rate reps earn on what their members pay
// @access  Private/Admin (marketing scope)
exports.updateMarketingCommission = asyncHandler(async (req, res) => {
  try {
    // Previous values go on the audit row: a quiet 20% -> 100% -> 20% change
    // otherwise leaves no before/after.
    const before = await getCommissionSettings();
    const settings = await saveCommissionSettings(req.body, req.user.id);
    logAudit('marketing_commission_updated', req.user.id, {
      rate: settings.rate,
      previousRate: before.rate,
      overrides: settings.overrides,
      previousOverrides: before.overrides,
    });
    res.json({ success: true, message: 'Commission updated', commission: settings });
  } catch (err) {
    if (err instanceof CommissionValidationError) throw createError.badRequest(err.message);
    throw err;
  }
});

// ==================== MARKETING PAYOUTS ====================

const assertMarketingUser = async (userId) => {
  const user = await User.findByPk(userId, { attributes: ['id', 'role'] });
  if (!user || !['marketing', 'marketing_manager'].includes(user.role)) {
    throw createError.notFound('Marketing user not found');
  }
  return user;
};

// @route   GET /api/v1/admin/marketing-users/:userId/payouts
// @desc    A rep's payout ledger — the same figures the rep sees
// @access  Private/Admin (marketing scope)
exports.getMarketingPayouts = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await assertMarketingUser(userId);
  const ledger = await getPayoutLedger(userId);
  res.json({ success: true, ...ledger });
});

// @route   POST /api/v1/admin/marketing-users/:userId/payouts
// @desc    Record a payout to a rep
// @access  Private/Admin (marketing scope)
exports.createMarketingPayout = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await assertMarketingUser(userId);
  try {
    const payout = await recordPayout(userId, req.body, req.user.id);
    logAudit('marketing_payout_recorded', req.user.id, {
      payoutId: payout.id,
      targetUserId: userId,
      amount: payout.amount,
      status: payout.status,
      method: payout.method,
      reference: payout.reference,
      overpay: Boolean(req.body.allowOverpay),
    });
    const ledger = await getPayoutLedger(userId);
    res.status(201).json({ success: true, message: 'Payout recorded', payout, ...ledger });
  } catch (err) {
    if (err instanceof PayoutValidationError) throw createError.badRequest(err.message);
    throw err;
  }
});

// @route   PUT /api/v1/admin/marketing-payouts/:payoutId
// @desc    Move a queued payout to paid (or back)
// @access  Private/Admin (marketing scope)
exports.updateMarketingPayout = asyncHandler(async (req, res) => {
  try {
    const { MarketingPayout } = require('../models');
    const before = await MarketingPayout.findByPk(req.params.payoutId);
    const previous = before
      ? { status: before.status, paidAt: before.paidAt, amount: before.amount }
      : null;
    const payout = await updatePayoutStatus(req.params.payoutId, req.body.status, { reference: req.body.reference });
    if (!payout) throw createError.notFound('Payout not found');
    logAudit('marketing_payout_updated', req.user.id, {
      payoutId: payout.id,
      targetUserId: payout.marketingUserId,
      amount: payout.amount,
      status: payout.status,
      previous,
    });
    const ledger = await getPayoutLedger(payout.marketingUserId);
    res.json({ success: true, message: 'Payout updated', payout, ...ledger });
  } catch (err) {
    if (err instanceof PayoutValidationError) throw createError.badRequest(err.message);
    throw err;
  }
});

// @route   DELETE /api/v1/admin/marketing-payouts/:payoutId
// @desc    Void a payout recorded in error. Soft: the row is kept (it is the
//          record that money left) with who/when/why, and stops counting toward
//          the rep's balance. A reason is required.
// @access  Private/Admin (payouts scope)
exports.deleteMarketingPayout = asyncHandler(async (req, res) => {
  try {
    const payout = await voidPayout(req.params.payoutId, { reason: req.body?.reason, adminId: req.user.id });
    if (!payout) throw createError.notFound('Payout not found');
    logAudit('marketing_payout_voided', req.user.id, {
      payoutId: payout.id,
      targetUserId: payout.marketingUserId,
      amount: payout.amount,
      status: payout.status,
      method: payout.method,
      reference: payout.reference,
      paidAt: payout.paidAt,
      reason: payout.voidReason,
    });
    const ledger = await getPayoutLedger(payout.marketingUserId);
    res.json({ success: true, message: 'Payout voided', ...ledger });
  } catch (err) {
    if (err instanceof PayoutValidationError) throw createError.badRequest(err.message);
    throw err;
  }
});

// ---- partner account care ----------------------------------------------------

const findPartner = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [{ model: Profile, attributes: ['id', 'firstName', 'lastName', 'city'] }],
    attributes: { exclude: ['password'] },
  });
  if (!user || !['marketing', 'marketing_manager'].includes(user.role)) {
    throw createError.notFound('Marketing user not found');
  }
  return user;
};

// @route   PUT /api/v1/admin/marketing-users/:userId
// @desc    Correct a partner's name, email or mobile number. A typo'd email is
//          otherwise permanent: it is the sign-in, the welcome mail and the
//          password-reset address all at once.
// @access  Private/Admin (marketing scope)
exports.updateMarketingUser = asyncHandler(async (req, res) => {
  const user = await findPartner(req.params.userId);
  const { firstName, lastName, email, phone } = req.body || {};
  const changed = [];

  const nameOk = (v) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 50;
  if (firstName !== undefined && !nameOk(firstName)) throw createError.badRequest('First name must be 1-50 characters');
  if (lastName !== undefined && !nameOk(lastName)) throw createError.badRequest('Last name must be 1-50 characters');

  if (email !== undefined) {
    const next = canonicalEmail(email) || null;
    if (!next) throw createError.badRequest('Enter a valid email address');
    if (next !== user.email) {
      const clash = await User.findOne({
        where: { email: { [Op.in]: emailLookupCandidates(next) }, id: { [Op.ne]: user.id } },
        attributes: ['id'],
      });
      if (clash) throw createError.conflict('Another account already uses this email');
      user.email = next;
      changed.push('email');
    }
  }

  if (phone !== undefined) {
    const next = cleanPhone(phone);
    if ((next || null) !== (user.phone || null)) {
      await assertPhoneFree(next, user.id);
      user.phone = next;
      changed.push('phone');
    }
  }

  await sequelize.transaction(async (t) => {
    if (changed.includes('email') || changed.includes('phone')) await user.save({ transaction: t });
    const profile = user.Profile;
    if (profile && ((firstName !== undefined && firstName.trim() !== profile.firstName) || (lastName !== undefined && lastName.trim() !== profile.lastName))) {
      if (firstName !== undefined) profile.firstName = firstName.trim();
      if (lastName !== undefined) profile.lastName = lastName.trim();
      await profile.save({ transaction: t });
      changed.push('name');
    }
  });

  // Field names only: the audit row records that something changed, not the PII.
  logAudit('marketing_user_updated', req.user.id, { targetUserId: user.id, fields: changed });

  const fresh = await findPartner(user.id);
  res.json({ success: true, message: changed.length ? 'Partner updated' : 'Nothing to change', user: fresh });
});

// @route   POST /api/v1/admin/marketing-users/:userId/reset-password
// @desc    Set a new password for a partner who is locked out. Signs them out
//          everywhere. The password is never stored, logged or emailed; the
//          admin hands it over.
// @access  Private/Admin (marketing scope)
exports.resetMarketingUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.userId);
  if (!user || !['marketing', 'marketing_manager'].includes(user.role)) {
    throw createError.notFound('Marketing user not found');
  }
  // Same rule as every other password (utils/passwordPolicy).
  const problem = passwordProblem(req.body?.password);
  if (problem) throw createError.badRequest(problem);

  user.password = req.body.password;
  await user.save();

  await RefreshToken.update(
    { isRevoked: true, revokedAt: new Date(), revokedReason: 'admin_password_reset' },
    { where: { userId: user.id, isRevoked: false } }
  );
  await markUserRevoked(user.id);

  logAudit('marketing_user_password_reset', req.user.id, { targetUserId: user.id });
  res.json({ success: true, message: 'Password updated. The partner has been signed out everywhere.' });
});

// @route   POST /api/v1/admin/marketing-users/:userId/resend-welcome
// @desc    Send the partner welcome email again (first steps, no password).
// @access  Private/Admin (marketing scope)
exports.resendPartnerWelcome = asyncHandler(async (req, res) => {
  const user = await findPartner(req.params.userId);
  let welcomeEmailSent = false;
  try {
    const sent = await sendPartnerWelcome(user.email, user.Profile?.firstName);
    welcomeEmailSent = Boolean(sent && sent.success !== false);
  } catch (err) {
    log.warn('Partner welcome resend failed', { userId: user.id, error: err.message });
  }
  logAudit('marketing_user_welcome_resent', req.user.id, { targetUserId: user.id, welcomeEmailSent });
  res.json({ success: true, welcomeEmailSent });
});

// @route   GET /api/v1/admin/marketing-users/:userId/report
// @desc    Full referral report for one rep — every invited member, whether
//          they signed up, and whether they paid. Same builder as the rep's
//          own /api/marketing/report, so both sides read one story.
// @access  Private/Admin (marketing scope)
exports.getMarketingUserReport = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findByPk(userId, {
    include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city'] }],
    attributes: { exclude: ['password'] },
  });
  if (!user || !['marketing', 'marketing_manager'].includes(user.role)) {
    throw createError.notFound('Marketing user not found');
  }

  const [report, onboarding, openLeads] = await Promise.all([
    buildMarketingReport(userId, req.query),
    getOnboarding(userId),
    countOpenLeads(userId),
  ]);
  res.json({ success: true, user, onboarding, openLeads: openLeads[userId] || 0, ...report });
});

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
    // From Subscriptions, the same source as the member report — the lead's
    // denormalised amountPaid disagreed with it whenever the webhook activated.
    getRepRevenue(userId),
  ]);

  res.json({
    success: true,
    user,
    stats: {
      totalLeads: leadsCount,
      convertedLeads: convertedCount,
      totalRevenue: revenueData || 0
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
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

  const and = [];
  if (isActive === 'true' || isActive === 'false') and.push({ isActive: isActive === 'true' });
  if (marketingUserId) and.push({ marketingUserId });
  if (search) {
    const term = `%${escapeLikePattern(search)}%`;
    and.push({
      [Op.or]: [
        { code: { [Op.iLike]: term } },
        { campaign: { [Op.iLike]: term } },
        { source: { [Op.iLike]: term } },
        sequelize.literal(`"ReferralCode"."marketingUserId" IN (
          SELECT u.id FROM "Users" u LEFT JOIN "Profiles" p ON p."userId" = u.id
           WHERE u.email ILIKE ${sequelize.escape(term)}
              OR TRIM(COALESCE(p."firstName", '') || ' ' || COALESCE(p."lastName", '')) ILIKE ${sequelize.escape(term)})`),
      ],
    });
  }
  const where = and.length ? { [Op.and]: and } : {};

  const { count, rows: codes } = await ReferralCode.findAndCountAll({
    where,
    include: [{
      model: User,
      as: 'MarketingUser',
      attributes: ['id', 'email', 'status'],
      include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }],
    }],
    limit,
    offset,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    distinct: true,
  });

  // What each code actually brought in, from the leads it created — the
  // usageCount counter only counts signups and can drift from them.
  const codeList = codes.map((c) => c.code);
  const counts = codeList.length ? await sequelize.query(
    `SELECT l."referralCode" AS code,
            COUNT(*)::int AS people,
            COUNT(l."convertedUserId")::int AS joined,
            COUNT(*) FILTER (WHERE l."convertedUserId" IN (${PAID_MEMBER_IDS_SQL}))::int AS paid
       FROM "MarketingLeads" l
      WHERE l."referralCode" IN (:codes)
      GROUP BY l."referralCode"`,
    { replacements: { codes: codeList }, type: sequelize.QueryTypes.SELECT }
  ) : [];
  const byCode = Object.fromEntries(counts.map((r) => [r.code, r]));

  res.json({
    success: true,
    codes: codes.map((c) => ({
      ...c.toJSON(),
      partnerName: partnerName(c.MarketingUser),
      people: byCode[c.code]?.people || 0,
      joined: byCode[c.code]?.joined || 0,
      paid: byCode[c.code]?.paid || 0,
    })),
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.max(Math.ceil(count / limit), 1),
    }
  });
});

// @route   POST /api/admin/referral-codes
// @desc    Create referral code
// @access  Private/Admin
exports.createReferralCode = asyncHandler(async (req, res) => {
  const { code: rawCode, marketingUserId, campaign, source } = req.body;

  if (!rawCode || !marketingUserId) {
    throw createError.badRequest('code and marketingUserId are required');
  }

  // The SAME normalisation checkout and the signup live-check use. A code the
  // resolver cannot read (underscore, space, markup, too short) would be a code
  // nobody could ever redeem, and a raw-value duplicate check ran before the
  // upper-casing so 'abc' passed when 'ABC' existed and then 500ed on the
  // unique index.
  const { normaliseCode } = require('../utils/referral');
  const code = normaliseCode(typeof rawCode === 'string' ? rawCode : '');
  if (!code) {
    throw createError.badRequest('Code must be 3-32 characters: letters, numbers and hyphens only, starting with a letter or number');
  }

  const user = await User.findByPk(marketingUserId);
  if (!user || !['marketing', 'marketing_manager'].includes(user.role)) {
    throw createError.badRequest('Invalid marketing user');
  }
  // A deactivated partner cannot sign in and their codes were switched off;
  // a fresh code for them would credit signups to someone nobody pays.
  if (user.status !== 'active') {
    throw createError.badRequest('This partner is not active. Reactivate them before giving them a new code.');
  }

  // A member code with this text would be shadowed (marketing resolves first),
  // and two owners of one string is the ambiguity this check exists to refuse.
  const [existing, memberOwner] = await Promise.all([
    ReferralCode.findOne({ where: { code } }),
    User.findOne({ where: { referralCode: code }, attributes: ['id'] }),
  ]);
  if (existing || memberOwner) throw createError.conflict('Referral code already exists');

  const referralCode = await ReferralCode.create({
    code,
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
  const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';

  // Every filter (partner, search, signed up, paid, source, code, dates) lives
  // in utils/partnerMembers so this list, one partner's page and the partner's
  // own report all agree on who is under whom.
  const where = buildLeadWhere(req.query);

  if (req.query.format === 'csv') return exportLeadsCsv(req, res, where);

  const [{ count, rows: leads }, summary] = await Promise.all([
    MarketingLead.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'AssignedMarketer',
          attributes: ['id', 'email', 'status', 'role'],
          include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }],
        },
        { model: User, as: 'ConvertedUser', attributes: ['id', 'email'] },
      ],
      limit,
      offset,
      order: [['createdAt', sort], ['id', sort]],
      distinct: true,
    }),
    summariseLeads(MarketingLead, where),
  ]);

  const facts = await memberFacts(leads);
  const rows = leads.map((l) => ({
    ...l.toJSON(),
    partnerName: partnerName(l.AssignedMarketer),
    member: l.convertedUserId ? (facts[l.convertedUserId] || null) : null,
  }));

  res.json({
    success: true,
    leads: rows,
    summary,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.max(Math.ceil(count / limit), 1),
    },
  });
});

// The filtered list as a spreadsheet: who each person is, which partner they
// are with, whether they joined and what they have paid. Streamed in batches
// like the members export, so a long list is never cut short.
async function exportLeadsCsv(req, res, where) {
  const total = await MarketingLead.count({ where });
  const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const header = [
    'Name', 'Phone', 'Email', 'City', 'Partner', 'Partner email', 'Referral code', 'Campaign', 'Added',
    'Lead status', 'Signed up', 'Signed up on', 'Member name', 'Member email', 'Account status',
    'Paid', 'Plan', 'Amount paid (INR)', 'Lead ID', 'Member ID',
  ];
  const batch = exportBatchSize();
  const result = await streamCsv(res, {
    filename: `tricitymatch-partner-members-${new Date().toISOString().slice(0, 10)}.csv`,
    header,
    total,
    log,
    fetchBatch: async (cursor) => {
      const and = [where];
      if (cursor) {
        and.push({
          [Op.or]: [
            { createdAt: { [Op.lt]: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { [Op.lt]: cursor.id } },
          ],
        });
      }
      const rows = await MarketingLead.findAll({
        where: { [Op.and]: and },
        include: [{
          model: User,
          as: 'AssignedMarketer',
          attributes: ['id', 'email'],
          include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }],
        }],
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: batch,
      });
      const facts = await memberFacts(rows);
      rows.forEach((r) => { r.dataValues.member = r.convertedUserId ? facts[r.convertedUserId] || null : null; });
      const last = rows[rows.length - 1];
      return { rows, next: rows.length === batch ? { createdAt: last.createdAt, id: last.id } : null };
    },
    toRow: (l) => {
      const m = l.dataValues.member;
      return [
        l.name,
        l.phone,
        l.email && l.email !== 'N/A' ? l.email : '',
        l.city,
        partnerName(l.AssignedMarketer),
        l.AssignedMarketer?.email,
        l.referralCode || 'Added by hand',
        l.campaign,
        ymd(l.createdAt),
        l.status,
        m ? 'yes' : 'no',
        m ? ymd(m.signedUpAt) : '',
        m?.name,
        m?.email,
        m?.status,
        m?.paid ? 'yes' : 'no',
        m?.planType,
        m ? m.amountPaid : '',
        l.id,
        l.convertedUserId,
      ];
    },
  });
  logAudit('partner_members_exported', req.user.id, {
    rows: result.rows,
    expected: total,
    complete: !result.aborted && result.rows === total,
    filters: Object.keys(req.query || {}).filter((k) => req.query[k] !== '' && k !== 'format'),
  });
}

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

// Published stories are public pages, so staff entries follow the same rule as
// member submissions: no phone numbers, emails, links or handles in the text.
const assertStoryHasNoContact = (data) => {
  if (['coupleNames', 'quote', 'location', 'tag'].some((k) => typeof data[k] === 'string' && findContactInText(data[k]))) {
    throw createError.badRequest('Take out phone numbers, email addresses, links and handles. Stories are published on the website for everyone to read.', 'CONTACT_IN_TEXT');
  }
};

// @route   POST /api/v1/admin/success-stories
// @desc    Create a success story (defaults to draft)
// @access  Admin
exports.createSuccessStory = asyncHandler(async (req, res) => {
  const data = sanitizeStoryInput(req.body);
  if (!data.coupleNames || !data.quote) {
    throw createError.badRequest('coupleNames and quote are required');
  }
  assertStoryHasNoContact(data);
  const story = await SuccessStory.create(data);
  logAudit('success_story_created', req.user.id, { storyId: story.id });
  res.status(201).json({ success: true, story });
});

// @route   PUT /api/v1/admin/success-stories/:id
// @desc    Update / publish a success story
// @access  Admin
exports.updateSuccessStory = asyncHandler(async (req, res) => {
  const story = await SuccessStory.findByPk(req.params.id);
  if (!story) throw createError.notFound('Story not found');
  const previous = story.status;
  const data = sanitizeStoryInput(req.body);
  assertStoryHasNoContact(data);
  await story.update(data);
  logAudit('success_story_updated', req.user.id, { storyId: story.id, previousStatus: previous, status: story.status });
  res.json({ success: true, story });
});

// @route   DELETE /api/v1/admin/success-stories/:id
// @desc    Delete a success story
// @access  Admin
exports.deleteSuccessStory = asyncHandler(async (req, res) => {
  const story = await SuccessStory.findByPk(req.params.id);
  if (!story) throw createError.notFound('Story not found');
  await story.destroy();
  logAudit('success_story_deleted', req.user.id, { storyId: req.params.id });
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

const lastTenDigits = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
};

/**
 * The member account behind each enquiry on a page, when there is one: the same
 * email (any spelling it may be stored under, any case), or else the same
 * 10-digit mobile number. Ordinary members only; a staff address writing in is
 * not a member account. Adds `memberId` and `memberMatch` ('email' | 'phone').
 */
const attachEnquiryMembers = async (messages) => {
  if (!messages.length) return;
  const emails = new Set();
  const phones = new Set();
  for (const m of messages) {
    emailLookupCandidates(m.email).forEach((e) => emails.add(e));
    const phone = lastTenDigits(m.phone);
    if (phone) phones.add(phone);
  }
  const anyOf = [];
  if (emails.size) {
    anyOf.push(sequelize.where(sequelize.fn('lower', sequelize.col('email')), { [Op.in]: [...emails] }));
  }
  if (phones.size) {
    anyOf.push(sequelize.where(
      sequelize.fn('right', sequelize.fn('regexp_replace', sequelize.col('phone'), '\\D', '', 'g'), 10),
      { [Op.in]: [...phones] }
    ));
  }
  const members = anyOf.length
    ? await User.findAll({ where: { role: 'user', [Op.or]: anyOf }, attributes: ['id', 'email', 'phone'] })
    : [];
  const byEmail = new Map();
  const byPhone = new Map();
  for (const u of members) {
    if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    const phone = lastTenDigits(u.phone);
    if (phone) byPhone.set(phone, u.id);
  }
  for (const m of messages) {
    const viaEmail = emailLookupCandidates(m.email).map((e) => byEmail.get(e)).find(Boolean) || null;
    const phone = lastTenDigits(m.phone);
    const viaPhone = phone ? byPhone.get(phone) || null : null;
    m.dataValues.memberId = viaEmail || viaPhone;
    m.dataValues.memberMatch = viaEmail ? 'email' : (viaPhone ? 'phone' : null);
  }
};

// @route   GET /api/v1/admin/contact-messages
// @desc    List public contact-form enquiries (support inbox)
// @access  Private/Admin
exports.getContactMessages = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const { status } = req.query;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

  const VALID_STATUSES = ['new', 'read', 'resolved'];
  const where = {};
  if (status && VALID_STATUSES.includes(status)) where.status = status;
  if (req.query.assigned === 'me') where.assignedTo = req.user.id;
  else if (req.query.assigned === 'unassigned') where.assignedTo = null;
  // "Not replied" is the list that matters on a busy day: answered enquiries
  // can still be open, and an unanswered one can have been marked read.
  if (req.query.replied === 'yes') where.repliedAt = { [Op.ne]: null };
  else if (req.query.replied === 'no') where.repliedAt = null;
  if (search) {
    const term = `%${escapeLikePattern(search)}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
      { subject: { [Op.iLike]: term } },
      { message: { [Op.iLike]: term } },
    ];
  }

  // Oldest first puts whoever has waited longest at the top; newest first stays
  // the default for callers that do not ask.
  const direction = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
  const { count, rows: messages } = await ContactMessage.findAndCountAll({
    where,
    order: [['createdAt', direction], ['id', direction]],
    limit,
    offset,
  });

  await attachEnquiryMembers(messages);

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
  const { getOffer, buildDefaults, getOfferState, getFoundingState, getReferralState } = require('../utils/launchOffer');
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
    referral: getReferralState(),
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
  const { saveOffer, OfferValidationError, getOfferState, getFoundingState, getReferralState } = require('../utils/launchOffer');

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
    referral: getReferralState(),
  });
});

// @route   GET /api/v1/admin/ranking-weights
// @desc    Current search ranking weights, the defaults, and the allowed ranges
// @access  Admin (ranking scope)
exports.getRankingWeights = asyncHandler(async (req, res) => {
  const { getWeights, DEFAULT_WEIGHTS, LIMITS, FACTOR_LABELS } = require('../utils/rankingWeights');
  res.json({ success: true, weights: getWeights(), defaults: DEFAULT_WEIGHTS, limits: LIMITS, labels: FACTOR_LABELS });
});

// @route   PUT /api/v1/admin/ranking-weights
// @desc    Save search ranking weights (or reset with { reset: true })
// @access  Admin (ranking scope)
exports.updateRankingWeights = asyncHandler(async (req, res) => {
  const { saveWeights, resetWeights } = require('../utils/rankingWeights');
  let weights;
  try {
    weights = req.body?.reset === true
      ? await resetWeights(req.user.id)
      : await saveWeights(req.body?.weights, req.user.id);
  } catch (err) {
    if (err.statusCode === 400) throw createError.badRequest(err.message);
    throw err;
  }
  logAudit('ranking_weights_updated', req.user.id, { weights, reset: req.body?.reset === true });
  res.json({ success: true, weights });
});

// @route   GET /api/v1/admin/ranking-experiment
// @desc    The running (or last) ranking experiment and what each arm did
// @access  Admin (ranking scope)
exports.getRankingExperiment = asyncHandler(async (req, res) => {
  const exp = require('../utils/rankingExperiment');
  const stored = await exp.readStored();
  const results = stored ? await exp.results(stored) : null;
  res.json({
    success: true,
    experiment: stored,
    variantWeights: stored ? exp.variantWeights(stored.overrides) : null,
    results,
    maxShare: exp.MAX_SHARE,
  });
});

// @route   PUT /api/v1/admin/ranking-experiment
// @desc    Start an experiment, or stop it with { stop: true }
// @access  Admin (ranking scope)
exports.updateRankingExperiment = asyncHandler(async (req, res) => {
  const exp = require('../utils/rankingExperiment');
  let experiment;
  try {
    experiment = req.body?.stop === true
      ? await exp.stopExperiment(req.user.id)
      : await exp.saveExperiment(req.body?.experiment, req.user.id);
  } catch (err) {
    if (err.statusCode === 400) throw createError.badRequest(err.message);
    throw err;
  }
  logAudit(req.body?.stop === true ? 'ranking_experiment_stopped' : 'ranking_experiment_started', req.user.id, { experiment });
  res.json({ success: true, experiment });
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
