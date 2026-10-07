/**
 * Marketing Routes
 * Endpoints for marketing users to manage their own data
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { auth, marketingAuth } = require('../middlewares/auth');
const { asyncHandler, createError, handleValidationErrors } = require('../middlewares/errorHandler');
const { MarketingLead, ReferralCode, User } = require('../models');
const { buildMarketingReport, getRepRevenue } = require('../utils/marketingReport');
const { getPayoutLedger } = require('../utils/marketingPayouts');
const { createManualLead } = require('../utils/manualLeads');
const teamCtl = require('../controllers/marketingTeamController');
const { getOnboarding, recordAgreement, requirePartnerAgreement } = require('../utils/partnerOnboarding');
const { PARTNER_GUIDE_VERSION } = require('../constants/partnerProgramme');
const { logAudit } = require('../middlewares/logger');
const { param, body } = require('express-validator');

// All marketing routes require authentication and marketing role
router.use(auth, marketingAuth);

// @route   GET /api/marketing/dashboard
// @desc    Get own marketing dashboard stats
// @access  Private/Marketing
router.get('/dashboard', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [leadsCount, contactedCount, convertedCount, revenueData, codesCount] = await Promise.all([
    MarketingLead.count({ where: { assignedToMarketingUserId: userId } }),
    MarketingLead.count({ where: { assignedToMarketingUserId: userId, status: 'contacted' } }),
    MarketingLead.count({ where: { assignedToMarketingUserId: userId, status: 'converted' } }),
    // Subscriptions are the source of truth for money (same as /report); the
    // lead's amountPaid copy went stale whenever the webhook activated a plan.
    getRepRevenue(userId),
    ReferralCode.count({ where: { marketingUserId: userId, isActive: true } })
  ]);

  res.json({
    success: true,
    stats: {
      totalLeads: leadsCount,
      contactedLeads: contactedCount,
      convertedLeads: convertedCount,
      totalRevenue: revenueData || 0,
      activeReferralCodes: codesCount
    }
  });
}));

// @route   GET /api/marketing/onboarding
// @desc    Where this partner is in getting set up (agreement, payout details,
//          first code, first lead) so the portal can show a live checklist.
// @access  Private/Marketing
router.get('/onboarding', asyncHandler(async (req, res) => {
  res.json({ success: true, onboarding: await getOnboarding(req.user.id) });
}));

// @route   POST /api/marketing/accept-agreement
// @desc    Record that the partner has read and accepted the current Partner
//          Guide. The version must match, so a stale tab cannot accept a guide
//          the partner never saw.
// @access  Private/Marketing
router.post('/accept-agreement',
  body('version').isString(),
  body('accepted').custom((v) => v === true || v === 'true'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    if (req.body.version !== PARTNER_GUIDE_VERSION) {
      throw createError.conflict('The Partner Guide has been updated. Reload and read the latest version.');
    }
    await recordAgreement(req.user.id, req);
    logAudit('partner_agreement_accepted', req.user.id, { version: PARTNER_GUIDE_VERSION });
    res.json({ success: true, onboarding: await getOnboarding(req.user.id) });
  }));

// @route   GET /api/marketing/team
// @desc    Team overview for marketing managers (numbers only)
// @access  Private/Marketing manager
router.get('/team', teamCtl.requireTeamView, teamCtl.getTeam);

// @route   GET /api/marketing/report
// @desc    Own referral report: every invited member, whether they signed up,
//          and whether they paid. Same builder the admin view uses, so a rep
//          and an admin never see two different stories about one referral.
// @access  Private/Marketing
router.get('/report', asyncHandler(async (req, res) => {
  const report = await buildMarketingReport(req.user.id, req.query);
  report.members = report.members.map(({ memberId, ...row }) => row);
  res.json({ success: true, ...report });
}));

// @route   GET /api/marketing/payouts
// @desc    Own payout ledger: commission earned, what has been paid out, and
//          what is still outstanding. Read-only — payouts are recorded by an
//          admin, so a rep can never move their own balance.
// @access  Private/Marketing
router.get('/payouts', asyncHandler(async (req, res) => {
  const ledger = await getPayoutLedger(req.user.id);
  // A voided payout stays visible (it was real money moving), but the admin's
  // internal reason for voiding it is not the rep's to read.
  ledger.payouts = ledger.payouts.map(({ voidReason, ...rest }) => rest);
  res.json({ success: true, ...ledger });
}));

// @route   GET/PUT /api/marketing/payout-details
// @desc    Where the rep wants to be paid. Read back MASKED only; the full
//          values are visible to admins through the audited payouts routes.
// @access  Private/Marketing
const payoutCtl = require('../controllers/marketingPayoutController');
router.get('/payout-details', payoutCtl.getMyPayoutDetails);
router.put('/payout-details', payoutCtl.saveMyPayoutDetails);

// @route   GET /api/marketing/leads
// @desc    Get own leads
// @access  Private/Marketing
router.get('/leads', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const { status, paymentStatus } = req.query;

  const VALID_LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];
  const VALID_PAYMENT_STATUSES = ['none', 'paid'];

  const where = { assignedToMarketingUserId: userId };
  if (status && VALID_LEAD_STATUSES.includes(status)) where.status = status;
  if (paymentStatus && VALID_PAYMENT_STATUSES.includes(paymentStatus)) where.paymentStatus = paymentStatus;

  const { count, rows: leads } = await MarketingLead.findAndCountAll({
    where,
    include: [
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
}));

// @route   POST /api/marketing/leads
// @desc    Add a person the partner already knows, before they sign up. When
//          that person creates an account without a code, the signup is
//          credited to this partner (see utils/manualLeads).
// @access  Private/Marketing
router.post('/leads',
  requirePartnerAgreement,
  // Shape only; the specific, user-readable checks live in createManualLead so
  // the message survives production (validation details are dev-only).
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('phone').isString().trim().isLength({ min: 1, max: 20 }),
  body('email').optional({ values: 'falsy' }).isString().trim().isLength({ max: 254 }),
  body('city').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { name, phone, email, city } = req.body;
    const lead = await createManualLead({ marketingUserId: req.user.id, name, phone, email, city });
    res.status(201).json({ success: true, lead });
  }));

// @route   PUT /api/marketing/leads/:leadId/status
// @desc    Update lead status (only own leads, only status field)
// @access  Private/Marketing
router.put('/leads/:leadId/status',
  param('leadId').isUUID(4),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { leadId } = req.params;
  const { status } = req.body;

  const VALID_LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];
  if (!status || !VALID_LEAD_STATUSES.includes(status)) {
    throw createError.badRequest(`status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`);
  }

  const lead = await MarketingLead.findOne({
    where: { id: leadId, assignedToMarketingUserId: userId }
  });
  if (!lead) throw createError.notFound('Lead not found');

  lead.status = status;
  await lead.save();

  res.json({ success: true, message: 'Lead status updated', lead });
}));

// @route   GET /api/marketing/referral-codes
// @desc    Get own referral codes
// @access  Private/Marketing
router.get('/referral-codes', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const rawLimit = parseInt(req.query.limit) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const { count, rows: codes } = await ReferralCode.findAndCountAll({
    where: { marketingUserId: userId },
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
}));

// @route   POST /api/marketing/referral-codes
// @desc    Create a new referral code for self
// @access  Private/Marketing
router.post('/referral-codes', requirePartnerAgreement, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { campaign, source } = req.body;

  // Auto-generate code: username prefix + random suffix
  const user = await require('../models').User.findByPk(userId, { attributes: ['email'] });
  const prefix = (user.email.split('@')[0] || 'MKT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  // Math.random() gave ~20 bits from a non-cryptographic PRNG, and a referral
  // code is a guessable-value problem: codes carry attribution and, in this
  // product, reward credit. Use the CSPRNG and an unambiguous alphabet.
  const randomSuffix = (len = 6) => {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
    const bytes = crypto.randomBytes(len);
    let out = '';
    for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
  };
  const suffix = randomSuffix();
  const code = `${prefix}${suffix}`;

  const existing = await ReferralCode.findOne({ where: { code } });
  if (existing) {
    const code2 = `${prefix}${randomSuffix()}`;
    const referralCode = await ReferralCode.create({
      code: code2,
      marketingUserId: userId,
      campaign: campaign || null,
      source: source || null,
      isActive: true,
      usageCount: 0
    });
    return res.status(201).json({ success: true, referralCode });
  }

  const referralCode = await ReferralCode.create({
    code,
    marketingUserId: userId,
    campaign: campaign || null,
    source: source || null,
    isActive: true,
    usageCount: 0
  });

  res.status(201).json({ success: true, referralCode });
}));

module.exports = router;
