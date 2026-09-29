/**
 * Block & Report Controller
 */

const { Block, Report, User, Profile, MediaReview } = require('../models');
const { Op } = require('sequelize');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { logAudit, log } = require('../middlewares/logger');
const sequelize = require('../config/database');
const { severRelationshipRows, evictChatRoom } = require('../utils/relationship');
const { REPORT_REASONS, HIGH_RISK_REASONS } = require('../constants/reportReasons');
const { sendEmail } = require('../utils/email');
const config = require('../config/env');

// Blocking used to insert a Block row and nothing else, so an existing mutual
// match kept its chat, its calls and its live socket room. The row alone is
// enforced at each contact channel (utils/blocks); this removes the standing
// relationship so nothing resumes on unblock without a fresh mutual choice, and
// tears down what is live right now.
//
// Match rows are kept (history, analytics, admin review) — only `isMutual` is
// cleared. Chat grants are revoked so a free-reply window cannot outlive the
// relationship. Failures here are logged, never surfaced: the Block row is
// already the authoritative barrier.
const severRelationship = async (blockerId, blockedUserId) => {
  try {
    await sequelize.transaction((t) => severRelationshipRows(blockerId, blockedUserId, { transaction: t }));
  } catch (err) {
    log.error('Block cleanup failed', { blockerId, blockedUserId, error: err.message });
  }
  evictChatRoom(blockerId, blockedUserId);
};

// @route   POST /api/block/:userId
// @desc    Block a user
// @access  Private
exports.blockUser = asyncHandler(async (req, res) => {
  const blockerId = req.user.id;
  const { userId: blockedUserId } = req.params;

  if (blockerId === blockedUserId) {
    throw createError.badRequest('You cannot block yourself');
  }

  const targetUser = await User.findByPk(blockedUserId);
  if (!targetUser) throw createError.notFound('User not found');

  // findOrCreate prevents duplicate errors
  const [, created] = await Block.findOrCreate({
    where: { blockerId, blockedUserId },
  });

  // Sever every existing channel even when the block row already existed: a
  // block that pre-dates this cleanup (or a partial failure) is repaired by
  // simply blocking again.
  await severRelationship(blockerId, blockedUserId);

  if (!created) {
    return res.json({ success: true, message: 'User was already blocked' });
  }

  logAudit('user_blocked', blockerId, { blockedUserId });

  res.status(201).json({ success: true, message: 'User blocked successfully' });
});

// @route   DELETE /api/block/:userId
// @desc    Unblock a user
// @access  Private
exports.unblockUser = asyncHandler(async (req, res) => {
  const blockerId = req.user.id;
  const { userId: blockedUserId } = req.params;

  const deleted = await Block.destroy({ where: { blockerId, blockedUserId } });

  if (!deleted) throw createError.notFound('Block record not found');

  logAudit('user_unblocked', blockerId, { blockedUserId });

  res.json({ success: true, message: 'User unblocked successfully' });
});

// @route   GET /api/block
// @desc    Get list of users I have blocked
// @access  Private
exports.getBlockedUsers = asyncHandler(async (req, res) => {
  const blocks = await Block.findAll({
    where: { blockerId: req.user.id },
    include: [{
      model: User,
      as: 'BlockedUser',
      attributes: ['id', 'email'],
      include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto', 'city'] }],
    }],
    order: [['createdAt', 'DESC']],
  });

  res.json({ success: true, blocks });
});

// @route   POST /api/report/:userId
// @desc    Report a user
// @access  Private
exports.reportUser = asyncHandler(async (req, res) => {
  const reporterId = req.user.id;
  const { userId: reportedUserId } = req.params;
  const { reason, description } = req.body;

  if (reporterId === reportedUserId) {
    throw createError.badRequest('You cannot report yourself');
  }

  if (!REPORT_REASONS.includes(reason)) {
    throw createError.badRequest('Invalid report reason');
  }

  const targetUser = await User.findByPk(reportedUserId);
  if (!targetUser) throw createError.notFound('User not found');

  // Threats, underage and financial-scam reports are urgent: they jump the
  // queue and staff are mailed immediately rather than finding them later.
  const urgent = HIGH_RISK_REASONS.includes(reason);

  const report = await Report.create({
    reporterId,
    reportedUserId,
    reason,
    priority: urgent ? 'urgent' : 'normal',
    escalatedAt: urgent ? new Date() : null,
    // typeof guard, not just optional chaining: a JSON body can send a number
    // or an array here, and `.substring` on either is a TypeError -> 500.
    description: typeof description === 'string' ? description.substring(0, 1000) : null,
    status: 'pending',
  });

  // A stolen-photo report puts the reported member's current photos in front of
  // the moderation desk. They stay live until a person decides.
  if (reason === 'stolen_photos') {
    try {
      const reported = await Profile.findOne({ where: { userId: reportedUserId }, attributes: ['photos', 'profilePhoto'] });
      const urls = [...new Set([...(reported?.photos || []), reported?.profilePhoto].filter(Boolean))];
      for (const url of urls) {
        await MediaReview.create({
          userId: reportedUserId, url, source: 'report', status: 'pending',
          provider: 'report', labels: ['stolen_photos'], reportId: report.id,
          wasProfilePhoto: url === reported.profilePhoto,
        });
      }
    } catch (err) {
      // The report itself is already stored; the desk can still work it from there.
      log.warn('Could not queue photos for stolen-photo report', { error: err.message, reportId: report.id });
    }
  }

  logAudit('user_reported', reporterId, { reportedUserId, reason, reportId: report.id, priority: report.priority });

  if (urgent) {
    // Best-effort: the report is already stored; a mail failure must not fail it.
    sendEmail({
      to: config.email.support,
      channel: 'documents',
      subject: `URGENT report: ${reason.replace(/_/g, ' ')}`,
      html: `<p>An urgent report (<strong>${reason.replace(/_/g, ' ')}</strong>) was filed. Open the Reports queue and review it now.</p><p>Report id: ${report.id}</p>`,
      text: `An urgent report (${reason}) was filed. Open the Reports queue and review it now. Report id: ${report.id}`,
    }).catch((err) => log.warn('Urgent-report email failed (report still stored)', { error: err.message, reportId: report.id }));
  }

  res.status(201).json({ success: true, message: 'Report submitted successfully', reportId: report.id });
});
