'use strict';

/**
 * Member invite links (Phase S).
 *
 * Two surfaces:
 *   GET /invite/:token   PUBLIC  — resolve an invite to the inviter's FIRST NAME.
 *   GET /invite/my-link  AUTH    — the caller's own token + shareable URL.
 *
 * The public resolve is the sensitive one. It is deliberately anaemic: first
 * name only, never a photo/city/profile-code/userId, so a scraped token buys an
 * attacker one string they could have read off the invite message anyway.
 * Unknown, malformed, inactive and profile-less tokens all produce the SAME
 * 404 body, so the endpoint cannot be used as an account oracle.
 */

const { User, Profile } = require('../models');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const config = require('../config/env');
const { getOrCreateInviteToken, buildInviteUrl } = require('../utils/inviteToken');

// One shared shape for every failure mode — valid-but-inactive must be
// indistinguishable from never-existed.
const notFound = () => createError.notFound('Invite link not found');

// @route   GET /api/v1/invite/:token
// @desc    Resolve an invite token to the inviter's first name (nothing else)
// @access  Public (rate-limited: inviteLimiter)
exports.resolveInvite = asyncHandler(async (req, res) => {
  const token = String(req.params.token || '').trim();

  // Cheap shape check before touching the DB — the token is 32 hex chars.
  if (!/^[0-9a-f]{16,128}$/i.test(token)) throw notFound();

  const user = await User.findOne({
    where: { inviteToken: token, status: 'active' },
    attributes: ['id'],
    include: [{ model: Profile, attributes: ['firstName', 'isActive'] }],
  });

  const firstName = user?.Profile?.isActive === false ? null : user?.Profile?.firstName;
  if (!user || !firstName) throw notFound();

  // firstName ONLY. Adding any other field here re-opens the profile-leak that
  // keeping invite tokens out of the profileCode namespace was meant to close.
  res.json({ success: true, invite: { firstName } });
});

// @route   GET /api/v1/invite/my-link
// @desc    The caller's own invite token + shareable signup URL (minted on first use)
// @access  Private
exports.getMyInviteLink = asyncHandler(async (req, res) => {
  const token = await getOrCreateInviteToken(req.user.id);
  if (!token) throw createError.internal('Could not create your invite link. Please try again.');

  // The reward is served from the server, not baked into client copy: it is
  // env-tunable (INVITE_REWARD_UNLOCKS) and can be switched off entirely, and a
  // hardcoded "get 3 unlocks" line would keep promising a reward after that.
  // 0 means the reward is off — surfaces then show the invite without a claim.
  const { INVITE_REWARD_UNLOCKS } = require('../utils/inviteReward');
  const rewardUnlocks = INVITE_REWARD_UNLOCKS();

  res.json({
    success: true,
    invite: {
      token,
      url: buildInviteUrl(token, config.server.frontendUrl),
      rewardUnlocks: rewardUnlocks > 0 ? rewardUnlocks : 0,
    },
  });
});
