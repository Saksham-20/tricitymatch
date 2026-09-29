'use strict';

/**
 * A member's own data, as one JSON document (DPDP right of access / portability;
 * the consent copy promises "see, correct, export or erase it at any time").
 *
 * Only the requesting member's own records: other members appear as opaque ids,
 * never as names or contact details. Credentials and internal machinery (password
 * hash, session token hashes, MFA material, payment signatures, device push
 * tokens, moderator notes) are excluded.
 */

const { Op } = require('sequelize');
const models = require('../models');
const { withSignedMedia, TTL } = require('./privateMedia');

const ROW_LIMIT = 50000;

const dump = async (Model, where, { exclude = [], order = [['createdAt', 'ASC']] } = {}) => {
  const rows = await Model.findAll({
    where,
    attributes: { exclude },
    order,
    limit: ROW_LIMIT + 1,
    raw: true,
  });
  return { rows: rows.slice(0, ROW_LIMIT), truncated: rows.length > ROW_LIMIT };
};

const buildMemberExport = async (userId) => {
  const {
    User, Profile, Match, Message, Notification, Subscription, UnlockPurchase, ContactUnlock, ProfileView,
    Block, Report, Verification, GroupMember, GroupMessage, GuardianLink, AstrologerBooking, ContactMessage,
    AnalyticsEvent, RefreshToken,
  } = models;

  const user = await User.findByPk(userId);
  const profile = await Profile.findOne({ where: { userId }, raw: true });

  const out = {
    generatedAt: new Date().toISOString(),
    notes: [
      'This file holds the personal data TricityMatch stores about you.',
      'Other members appear only as ids. Passwords, session tokens and security keys are never included.',
      'Photos and videos are listed as links to the files we host.',
    ],
    account: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      role: user.role,
      status: user.status,
      signedInWithGoogle: Boolean(user.googleId),
      twoStepVerificationEnabled: Boolean(user.mfaEnabledAt),
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      termsAcceptedAt: user.termsAcceptedAt,
      termsVersion: user.termsVersion,
      // How the acceptance was recorded (ip, user agent, optional choices).
      consent: user.consent || null,
      termsVersion: user.termsVersion,
    },
    profile,
  };

  const truncated = [];
  const collect = async (key, promise) => {
    const { rows, truncated: cut } = await promise;
    out[key] = rows;
    if (cut) truncated.push(key);
  };

  await Promise.all([
    collect('interestsYouSent', dump(Match, { userId })),
    collect('messages', dump(Message, { [Op.or]: [{ senderId: userId }, { receiverId: userId }] })),
    collect('notifications', dump(Notification, { userId })),
    collect('subscriptions', dump(Subscription, { userId }, { exclude: ['razorpaySignature', 'lifecycleMail'] })),
    collect('unlockPurchases', dump(UnlockPurchase, { userId }, { exclude: ['razorpaySignature'] })),
    collect('contactsYouUnlocked', dump(ContactUnlock, { userId })),
    collect('profilesYouViewed', dump(ProfileView, { viewerId: userId })),
    collect('profileViewsOfYou', dump(ProfileView, { viewedUserId: userId })),
    collect('membersYouBlocked', dump(Block, { blockerId: userId })),
    collect('reportsYouFiled', dump(Report, { reporterId: userId }, { exclude: ['adminNotes', 'reviewedBy'] })),
    collect('verification', dump(Verification, { userId }, {
      exclude: ['adminNotes', 'verifiedBy', 'documentFront', 'documentBack'],
    })),
    collect('familyGroupMemberships', dump(GroupMember, { userId })),
    collect('familyGroupMessages', dump(GroupMessage, { senderId: userId })),
    collect('guardianLinks', dump(GuardianLink, { [Op.or]: [{ candidateId: userId }, { guardianId: userId }] }, { exclude: ['inviteToken'] })),
    collect('astrologerBookings', dump(AstrologerBooking, { userId }, { exclude: ['razorpaySignature'] })),
    collect('supportEnquiries', dump(ContactMessage, {
      [Op.or]: [
        ...(user.email ? [{ email: user.email }] : []),
        ...(user.phone ? [{ phone: user.phone }] : []),
      ],
    }, { exclude: ['ipAddress', 'repliedBy', 'assignedTo'] })),
    collect('activityEvents', dump(AnalyticsEvent, { userId })),
    collect('signedInDevices', dump(RefreshToken, { userId }, {
      exclude: ['token', 'tokenHash', 'family'],
    })),
  ]);

  // The queries above are raw, so private media would go out as the permanent
  // stored asset URL. Hand out expiring links instead, like every other surface.
  if (out.profile) {
    out.profile = withSignedMedia(out.profile, { voiceIntroUrl: TTL.playback, videoIntroUrl: TTL.playback });
  }
  out.messages = out.messages.map((m) => withSignedMedia(m, { mediaUrl: TTL.playback }));
  out.verification = out.verification.map((v) => withSignedMedia(v, { selfiePhoto: TTL.playback, selfieVideoUrl: TTL.playback }));

  if (truncated.length) out.truncated = truncated;
  return out;
};

module.exports = { buildMemberExport, ROW_LIMIT };
