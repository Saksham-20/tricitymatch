'use strict';

/**
 * Member invite tokens (Phase S).
 *
 * A member's invite link carries an opaque random token, NOT their profile code.
 * This separation is the whole security property:
 *
 *   - `utils/profileCode.js` codes are DERIVED from the userId (first UUID
 *     segment) and resolve to a FULL PROFILE through `GET /search/by-code`.
 *   - An invite token is ≥128-bit random, stored in `Users.inviteToken`, and
 *     resolves to a FIRST NAME and nothing else (`GET /invite/:token`, public).
 *
 * Because the token is stored rather than derived it can also be rotated, and a
 * deleted/deactivated inviter simply stops resolving (the signup page folds into
 * its "invite silently absent" state). A derivation with a distinct salt would
 * have neither property.
 *
 * Minting is LAZY: nothing is written until a member actually asks for their
 * link, so signup stays a two-insert transaction and dormant accounts never
 * carry a token.
 */

const crypto = require('crypto');
const { log } = require('../middlewares/logger');

// 16 bytes = 128 bits of entropy, hex-encoded to 32 chars. Unguessable, and
// visually distinct from a `TCS-XXXXXXXX` profile code (which is 8 hex chars
// behind a prefix) so the two can never be confused by a human or a parser.
const TOKEN_BYTES = 16;

const generateInviteToken = () => crypto.randomBytes(TOKEN_BYTES).toString('hex');

/**
 * Return the caller's invite token, minting one on first use.
 *
 * The unique index `users_invite_token` (migration 000048) is the collision
 * backstop; on the astronomically unlikely duplicate we simply retry with fresh
 * randomness rather than trusting the generator blindly.
 *
 * @param {string} userId
 * @returns {Promise<string|null>} the token, or null if it could not be minted.
 */
const getOrCreateInviteToken = async (userId) => {
  if (!userId) return null;

  const { User } = require('../models');

  const user = await User.findByPk(userId, { attributes: ['id', 'inviteToken'] });
  if (!user) return null;
  if (user.inviteToken) return user.inviteToken;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateInviteToken();
    try {
      // Conditional update: only claim the token if the row still has none, so
      // two concurrent requests for the same user cannot overwrite each other.
      const [updated] = await User.update(
        { inviteToken: token },
        { where: { id: userId, inviteToken: null } }
      );
      if (updated > 0) return token;

      // Someone else minted it first — return theirs.
      const fresh = await User.findByPk(userId, { attributes: ['inviteToken'] });
      if (fresh?.inviteToken) return fresh.inviteToken;
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
      log.warn('Invite token collision, retrying', { userId, attempt });
    }
  }

  log.warn('Could not mint an invite token after retries', { userId });
  return null;
};

/**
 * Build the shareable signup URL for a token.
 * The query param is `invite` — NEVER `ref`, which the marketing referral flow
 * already consumes in authController.signup. Both may appear on one URL and are
 * honoured independently.
 */
const buildInviteUrl = (token, frontendUrl) =>
  `${String(frontendUrl || '').replace(/\/+$/, '')}/signup?invite=${encodeURIComponent(token)}`;

module.exports = { generateInviteToken, getOrCreateInviteToken, buildInviteUrl, TOKEN_BYTES };
