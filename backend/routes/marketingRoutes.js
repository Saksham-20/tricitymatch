/**
 * Marketing Routes
 * Endpoints for marketing users to manage their own data
 */

const express = require('express');
const router = express.Router();
const { auth, marketingAuth } = require('../middlewares/auth');
const { asyncHandler, createError, handleValidationErrors } = require('../middlewares/errorHandler');
const { MarketingLead, ReferralCode, User } = require('../models');
const sequelize = require('../config/database');
const { param } = require('express-validator');

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
    sequelize.query(
      `SELECT SUM("amountPaid")::float AS total FROM "MarketingLeads" WHERE "assignedToMarketingUserId" = :userId AND "paymentStatus" = 'paid'`,
      { replacements: { userId }, type: sequelize.QueryTypes.SELECT }
    ),
    ReferralCode.count({ where: { marketingUserId: userId, isActive: true } })
  ]);

  res.json({
    success: true,
    stats: {
      totalLeads: leadsCount,
      contactedLeads: contactedCount,
      convertedLeads: convertedCount,
      totalRevenue: revenueData[0]?.total || 0,
      activeReferralCodes: codesCount
    }
  });
}));

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

module.exports = router;
