/**
 * Account erasure (deep security audit 2026-08-21).
 *
 * DELETE /auth/account previously set User.status = 'deleted' and destroyed the
 * refresh tokens. Nothing else was touched, so after a member "deleted" their
 * account the database still held, indefinitely:
 *
 *   - the full Profile: exact date of birth, birth time, place of birth, caste,
 *     sub-caste, gotra, income, photos, voice and video intro URLs
 *   - Verifications: the KYC selfie and liveness video URLs
 *   - every Message they had written
 *   - GuardianLinks: the name and phone number of a parent or relative who
 *     never signed up and never consented to an account at all
 *   - ProfileViews, Matches, ContactUnlocks, AnalyticsEvents
 *
 * That is not a deletion, and India's DPDP Act gives data principals a right to
 * erasure. This module implements it.
 *
 * Why anonymise-in-place rather than DELETE FROM "Users":
 * five foreign keys into Users use ON DELETE NO ACTION (GroupMembers.userId,
 * GroupMessages.senderId, Groups.createdBy, Groups.candidateUserId,
 * UnlockPurchases.userId), so a hard delete is refused by the database for any
 * member who has ever joined a family group or bought an unlock bundle. Keeping
 * a scrubbed User row satisfies every FK while removing the identifiers.
 *
 * What is DELETED: everything that is personal data about this member and is
 * not needed to keep another member's records coherent.
 *
 * What is TOMBSTONED rather than deleted: message bodies. The text is the
 * personal data and it is destroyed; the row survives so the other participant's
 * conversation does not develop holes. This is the conventional approach.
 *
 * What is RETAINED: Subscriptions and UnlockPurchases (financial records needed
 * for accounting, reconciliation and refunds -- they carry amounts and payment
 * identifiers, not free-text personal data) and Reports (a moderation record
 * about conduct, which would otherwise be erasable by the reported party simply
 * by deleting their account).
 */

const crypto = require('crypto');
const { Op } = require('sequelize');

// Required lazily inside eraseAccount rather than at module load. authController
// imports this module, and a load-time `require('../config/database')` opens a
// connection as a side effect of importing the controller -- which broke every
// unit test that mocks config/env without also mocking the database.
const models = () => require('../models');
const db = () => require('../config/database');

const TOMBSTONE = '[deleted]';

/**
 * Erase a member's personal data. Returns a per-table count so the action can
 * be audited and so a caller can assert the erasure actually did something.
 */
const eraseAccount = async (userId) => {
  const counts = {};
  const sequelize = db();
  // User is deliberately absent: the Users row is scrubbed via raw SQL below,
  // because the model's beforeUpdate hook rejects a user with neither email nor
  // phone and would re-hash the placeholder password we write.
  const {
    Profile, Verification, GuardianLink, ProfileView, Match, ContactUnlock,
    Notification, RefreshToken, CallSession, AnalyticsEvent, ChatGrant, Block,
    GroupMember,
  } = models();

  await sequelize.transaction(async (transaction) => {
    const bothWays = (a, b) => ({ [Op.or]: [{ [a]: userId }, { [b]: userId }] });

    // ── Rows that are wholly this member's personal data ──
    counts.profiles = await Profile.destroy({ where: { userId }, transaction });
    // KYC selfie + liveness video.
    counts.verifications = await Verification.destroy({ where: { userId }, transaction });
    // Contains a third party's name and phone number.
    counts.guardianLinks = await GuardianLink.destroy({
      where: bothWays('candidateId', 'guardianId'), transaction,
    });
    counts.profileViews = await ProfileView.destroy({
      where: bothWays('viewerId', 'viewedUserId'), transaction,
    });
    counts.matches = await Match.destroy({
      where: bothWays('userId', 'matchedUserId'), transaction,
    });
    counts.contactUnlocks = await ContactUnlock.destroy({
      where: bothWays('userId', 'targetUserId'), transaction,
    });
    counts.notifications = await Notification.destroy({ where: { userId }, transaction });
    counts.callSessions = await CallSession.destroy({
      where: bothWays('callerId', 'calleeId'), transaction,
    });
    counts.analyticsEvents = await AnalyticsEvent.destroy({ where: { userId }, transaction });
    counts.chatGrants = await ChatGrant.destroy({
      where: bothWays('freeUserId', 'premiumUserId'), transaction,
    });
    counts.blocks = await Block.destroy({
      where: bothWays('blockerId', 'blockedUserId'), transaction,
    });
    counts.groupMemberships = await GroupMember.destroy({ where: { userId }, transaction });
    counts.refreshTokens = await RefreshToken.destroy({ where: { userId }, transaction });

    // ── Message bodies: destroy the content, keep the row ──
    // RETURNING gives an accurate row count; a bare UPDATE through
    // sequelize.query does not report one usefully, and an erasure audit log
    // that always says 0 is worse than no log at all.
    const [directMessages] = await sequelize.query(
      `UPDATE "Messages"
         SET "content" = :tombstone, "mediaUrl" = NULL, "reactions" = '{}'::jsonb
       WHERE "senderId" = :userId AND "content" <> :tombstone
       RETURNING "id"`,
      { replacements: { tombstone: TOMBSTONE, userId }, transaction }
    );
    counts.messagesTombstoned = directMessages.length;

    const [groupMessages] = await sequelize.query(
      `UPDATE "GroupMessages" SET "content" = :tombstone
       WHERE "senderId" = :userId AND "content" <> :tombstone
       RETURNING "id"`,
      { replacements: { tombstone: TOMBSTONE, userId }, transaction }
    );
    counts.groupMessagesTombstoned = groupMessages.length;

    // ── Scrub the User row itself ──
    //
    // A raw UPDATE deliberately: the model's beforeUpdate hook rejects a user
    // with neither email nor phone, and would re-hash the random password we
    // write here. The tombstone address satisfies the invariant while carrying
    // no personal data, and nulling the phone releases it from the partial
    // unique index so that number can register again.
    await sequelize.query(
      `UPDATE "Users"
          SET "email" = :email,
              "phone" = NULL,
              "googleId" = NULL,
              "fcmTokens" = ARRAY[]::text[],
              "password" = :password,
              "inviteToken" = NULL,
              "emailVerified" = false,
              "phoneVerified" = false,
              "status" = 'deleted',
              "updatedAt" = NOW()
        WHERE "id" = :userId`,
      {
        replacements: {
          userId,
          email: `deleted-${crypto.randomUUID()}@deleted.invalid`,
          // Not a usable credential: a bcrypt-shaped string no password hashes to.
          password: `!erased!${crypto.randomBytes(24).toString('hex')}`,
        },
        transaction,
      }
    );
  });

  return counts;
};

module.exports = { eraseAccount, TOMBSTONE };
