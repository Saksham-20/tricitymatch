/**
 * notifyUser — creates a DB Notification and optionally emits
 * a real-time Socket.io event to the target user.
 *
 * @param {string} userId   — UUID of recipient
 * @param {string} type     — Notification type (see Notification model enum)
 * @param {string} title    — Short title
 * @param {string} body     — Longer description
 * @param {string} [relatedId] — Optional UUID of related entity
 */

const { Notification, User } = require('../models');
const { getIO } = require('./socket');
const { log } = require('../middlewares/logger');
const { sendPushNotification } = require('./fcm');

const notify = async (userId, type, title, body, relatedId = null) => {
  try {
    const notification = await Notification.create({ userId, type, title, body, relatedId });

    // Emit real-time event if user has an active socket connection
    const io = getIO();
    if (io) {
      io.to(`user_${userId}`).emit('notification', {
        id: notification.id,
        type,
        title,
        body,
        relatedId,
        isRead: false,
        createdAt: notification.createdAt,
      });
    }

    // Send FCM push notification (non-blocking, best-effort)
    setImmediate(async () => {
      try {
        const user = await User.findByPk(userId, { attributes: ['id', 'fcmTokens'] });
        if (user?.fcmTokens?.length) {
          const { failedTokens } = await sendPushNotification(
            user.fcmTokens, title, body, { type, relatedId: relatedId || '' }
          );
          // Remove invalidated tokens to keep the list clean
          if (failedTokens.length > 0) {
            const cleanedTokens = user.fcmTokens.filter(t => !failedTokens.includes(t));
            await User.update({ fcmTokens: cleanedTokens }, { where: { id: userId } });
          }
        }
      } catch (pushErr) {
        log.error('FCM push failed in notifyUser', { userId, error: pushErr.message });
      }
    });

    return notification;
  } catch (err) {
    // Non-fatal — log but don't crash the calling request
    log.error('notifyUser failed', { userId, type, error: err.message });
  }
};

module.exports = { notify };
