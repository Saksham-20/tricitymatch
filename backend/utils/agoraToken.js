'use strict';

const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const config = require('../config/env');
const { log } = require('../middlewares/logger');

/**
 * Generate an Agora RTC token for a channel.
 * Returns null if Agora is not configured (dev without credentials).
 *
 * @param {string} channelName
 * @param {number} uid  - 0 = server-assigned UID
 * @returns {{ token: string, channelName: string, uid: number, expiresAt: number } | null}
 */
const generateRtcToken = (channelName, uid = 0) => {
  if (!config.agora.isConfigured()) {
    log.debug('Agora not configured — returning dev token stub', { channelName });
    return null;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + config.agora.tokenExpiry;
  const token = RtcTokenBuilder.buildTokenWithUid(
    config.agora.appId,
    config.agora.appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expiresAt
  );

  return { token, channelName, uid, expiresAt };
};

module.exports = { generateRtcToken };
