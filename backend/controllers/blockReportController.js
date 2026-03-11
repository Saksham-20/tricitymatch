/**
 * Block & Report Controller
 */

const { Block, Report, User, Profile } = require('../models');
const { Op } = require('sequelize');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { logAudit } = require('../middlewares/logger');

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

  const validReasons = ['fake_profile', 'harassment', 'spam', 'inappropriate_content', 'underage', 'other'];
  if (!validReasons.includes(reason)) {
    throw createError.badRequest('Invalid report reason');
  }

  const targetUser = await User.findByPk(reportedUserId);
  if (!targetUser) throw createError.notFound('User not found');

  const report = await Report.create({
    reporterId,
    reportedUserId,
    reason,
    description: description?.substring(0, 1000) || null,
    status: 'pending',
  });

  logAudit('user_reported', reporterId, { reportedUserId, reason, reportId: report.id });

  res.status(201).json({ success: true, message: 'Report submitted successfully', reportId: report.id });
});
