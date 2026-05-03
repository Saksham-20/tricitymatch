'use strict';

const admin = require('firebase-admin');
const config = require('../config/env');
const { log } = require('../middlewares/logger');

let _app = null;

const getApp = () => {
  if (_app) return _app;

  if (!config.fcm.isConfigured()) {
    return null;
  }

  try {
    const serviceAccount = require(config.fcm.serviceAccountPath);
    _app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: config.fcm.projectId,
    });
  } catch (err) {
    log.error('Failed to initialize Firebase Admin', { error: err.message });
    return null;
  }

  return _app;
};

/**
 * Send push notification to one or more FCM device tokens.
 * Silently removes invalid/expired tokens from the provided array and returns
 * the cleaned list so callers can persist the update.
 *
 * @param {string[]} tokens  FCM registration tokens
 * @param {string}   title
 * @param {string}   body
 * @param {object}   [data]  Extra key-value pairs sent as data payload
 * @returns {{ successCount: number, failedTokens: string[] }}
 */
const sendPushNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failedTokens: [] };
  }

  const app = getApp();
  if (!app) {
    log.debug('FCM not configured — skipping push notification', { title });
    return { successCount: 0, failedTokens: [] };
  }

  const messaging = admin.messaging(app);

  const message = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      notification: { clickAction: 'FLUTTER_NOTIFICATION_CLICK', sound: 'default' },
      priority: 'high',
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  };

  const failedTokens = [];
  let successCount = 0;

  // Send in batches of 500 (FCM multicast limit)
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const response = await messaging.sendEachForMulticast({ ...message, tokens: batch });
      successCount += response.successCount;

      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code;
          // Mark unregistered/invalid tokens for removal
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            failedTokens.push(batch[idx]);
          }
        }
      });
    } catch (err) {
      log.error('FCM batch send failed', { error: err.message, batchSize: batch.length });
    }
  }

  if (successCount > 0 || failedTokens.length > 0) {
    log.debug('FCM push sent', { title, successCount, failedCount: failedTokens.length });
  }

  return { successCount, failedTokens };
};

module.exports = { sendPushNotification };
