/**
 * Notification Controller
 */

const { Notification, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { resolvePrefs, validatePrefsUpdate } = require('../utils/notificationPrefs');
const { unreadNotificationCount, pushUnreadCounts } = require('../utils/unreadCounts');

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

  const unreadCount = await unreadNotificationCount(req.user.id);

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
// @desc    Get unread notification count (lightweight). The web app gets this
//          pushed over the socket (utils/unreadCounts) and polls only as a
//          safety net; shipped mobile builds still poll it.
// @access  Private
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await unreadNotificationCount(req.user.id);
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
  // The member's other open tabs drop their badge too.
  pushUnreadCounts(req.user.id, 'notifications');

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
  pushUnreadCounts(req.user.id, 'notifications');
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
  pushUnreadCounts(req.user.id, 'notifications');

  res.json({ success: true, message: 'Notification deleted' });
});

// @route   POST /api/notifications/fcm-token
// @desc    Register a device FCM token for push notifications
// @access  Private
exports.registerFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  // Upper bound as well as lower. Real FCM registration tokens are ~150-200
  // characters; without a ceiling a member could park ten multi-megabyte
  // strings in this JSONB column, which every push fan-out then reads.
  const MAX_FCM_TOKEN_LENGTH = 512;
  if (
    !token ||
    typeof token !== 'string' ||
    token.length < 10 ||
    token.length > MAX_FCM_TOKEN_LENGTH
  ) {
    throw createError.badRequest('Valid FCM token required');
  }

  // A device token belongs to ONE account: whoever signs in on the device now.
  // Logout deregistration is best-effort (needs a session and a network), so a
  // token left on the previous account would keep delivering that account's
  // pushes (full names included) to a phone now signed in as someone else.
  await sequelize.query(
    'UPDATE "Users" SET "fcmTokens" = array_remove("fcmTokens", :token) WHERE id <> :id AND :token = ANY("fcmTokens")',
    { replacements: { token, id: req.user.id } }
  );

  const user = await User.findByPk(req.user.id, { attributes: ['id', 'fcmTokens'] });
  const existing = user.fcmTokens || [];

  if (!existing.includes(token)) {
    // Cap at 10 tokens per user (handles many devices without unbounded growth)
    const updated = [...existing, token].slice(-10);
    await User.update({ fcmTokens: updated }, { where: { id: req.user.id } });
  }

  res.json({ success: true, message: 'FCM token registered' });
});

// @route   DELETE /api/notifications/fcm-token
// @desc    Remove a device FCM token (on logout or permission revoked)
// @access  Private
exports.removeFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') throw createError.badRequest('FCM token required');

  const user = await User.findByPk(req.user.id, { attributes: ['id', 'fcmTokens'] });
  const updated = (user.fcmTokens || []).filter(t => t !== token);
  await User.update({ fcmTokens: updated }, { where: { id: req.user.id } });

  res.json({ success: true, message: 'FCM token removed' });
});

// @route   GET /api/notifications/preferences
// @access  Private
exports.getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'notificationPrefs'] });
  res.json({ success: true, preferences: resolvePrefs(user?.notificationPrefs) });
});

// @route   PUT /api/notifications/preferences
// @desc    Change one or more preferences ({ matches: false, ... })
// @access  Private
exports.updatePreferences = asyncHandler(async (req, res) => {
  const checked = validatePrefsUpdate(req.body);
  if (!checked.ok) throw createError.badRequest(checked.error);
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'notificationPrefs'] });
  if (!user) throw createError.unauthorized('Not authenticated');
  const next = { ...resolvePrefs(user.notificationPrefs), ...checked.patch };
  user.notificationPrefs = next;
  await user.save({ fields: ['notificationPrefs'], hooks: false });
  res.json({ success: true, preferences: next });
});
