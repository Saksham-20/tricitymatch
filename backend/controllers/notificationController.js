/**
 * Notification Controller
 */

const { Notification } = require('../models');
const { Op } = require('sequelize');
const { createError, asyncHandler } = require('../middlewares/errorHandler');

// @route   GET /api/notifications
// @desc    Get notifications for current user (paginated)
// @access  Private
exports.getNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const { count, rows: notifications } = await Notification.findAndCountAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const unreadCount = await Notification.count({
    where: { userId: req.user.id, isRead: false },
  });

  res.json({
    success: true,
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / parseInt(limit)),
    },
  });
});

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count (lightweight)
// @access  Private
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  res.json({ success: true, count });
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
exports.markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!notification) throw createError.notFound('Notification not found');

  notification.isRead = true;
  await notification.save();

  res.json({ success: true, notification });
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.update(
    { isRead: true },
    { where: { userId: req.user.id, isRead: false } }
  );
  res.json({ success: true, message: 'All notifications marked as read' });
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
exports.deleteNotification = asyncHandler(async (req, res) => {
  const deleted = await Notification.destroy({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!deleted) throw createError.notFound('Notification not found');

  res.json({ success: true, message: 'Notification deleted' });
});
