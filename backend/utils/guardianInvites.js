'use strict';

/**
 * Guardian invite lifecycle (audit P1-14).
 *
 * A guardian link is a candidate handing a relative read-only sight of their
 * matches. Three rules follow from that being the candidate's private business:
 *
 *   1. The guardian has to say yes. Linking an existing member straight to
 *      `active` gave a stranger's account a window onto someone's profile with
 *      no say from the person being linked.
 *   2. An invite is only ever pending for a limited time. It used to stay
 *      `pending` forever, and pendings counted toward the 3-guardian cap, so
 *      three ignored invites locked the feature for good.
 *   3. The response must not say whether the address belongs to a member.
 *
 * A pending link carries `inviteExpiresAt`. Everything that reads "live" links
 * goes through `liveLinks()` so an expired row is never counted, listed or
 * accepted, whether or not the sweeper has run yet.
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const { GuardianLink, User, Profile } = require('../models');
const { emailLookupCandidates, canonicalEmail } = require('./emailAddress');
const config = require('../config/env');

const MAX_GUARDIANS = 3;
const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

// Outbound-mail abuse limits. The live-link checks only count open links, so
// invite -> revoke -> invite could mail the same address again and again; these
// count every invite created in the window whatever became of it.
const INVITE_WINDOW_MS = 24 * 3600 * 1000;
const MAX_INVITES_PER_CANDIDATE_PER_DAY = 6;
const MAX_INVITES_PER_ADDRESS_PER_DAY = 2;    // across all candidates (siblings share a parent)

/** Where-fragment: active links plus pending links that have not expired. */
const liveLinks = (now = new Date()) => ({
  [Op.or]: [
    { status: 'active' },
    { status: 'pending', inviteExpiresAt: { [Op.gt]: now } },
  ],
});

/**
 * Throws-by-return: the reason an invite to `email` must wait, or null. Counts
 * revoked and expired rows too. The wording never says whether the address is a
 * member or who else invited it.
 */
const inviteCooldown = async ({ candidateId, email, now = new Date() }) => {
  const since = new Date(now.getTime() - INVITE_WINDOW_MS);
  const [sameCandidateAddress, byCandidate, byAddress] = await Promise.all([
    GuardianLink.count({ where: { candidateId, inviteEmail: email, createdAt: { [Op.gt]: since } } }),
    GuardianLink.count({ where: { candidateId, createdAt: { [Op.gt]: since } } }),
    GuardianLink.count({ where: { inviteEmail: email, createdAt: { [Op.gt]: since } } }),
  ]);
  if (sameCandidateAddress > 0) return 'You already invited this address in the last day. Please wait before sending another invite to it.';
  if (byCandidate >= MAX_INVITES_PER_CANDIDATE_PER_DAY) return 'You have sent several invites today. Please try again tomorrow.';
  if (byAddress >= MAX_INVITES_PER_ADDRESS_PER_DAY) return 'This address was invited recently. Please try again tomorrow.';
  return null;
};

/** Pending links whose window has passed. */
const staleLinks = (now = new Date()) => ({
  status: 'pending',
  [Op.or]: [{ inviteExpiresAt: { [Op.lte]: now } }, { inviteExpiresAt: null }],
});

/**
 * Close expired pendings (optionally for one candidate). A link is closed, not
 * deleted, so the candidate's history and the audit trail keep the fact.
 */
const expireStaleInvites = async ({ candidateId } = {}) => {
  const where = { ...staleLinks() };
  if (candidateId) where.candidateId = candidateId;
  const [count] = await GuardianLink.update({ status: 'revoked', inviteToken: null }, { where });
  return count;
};

// The emailed token is a bearer secret. Only its hash is stored, so a copy of
// the table cannot be used to accept anyone's invite.
const hashInviteToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const newInviteToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashInviteToken(token) };
};

/**
 * Find the member an address belongs to, tolerating the stored forms older
 * accounts were saved under.
 */
const findMemberByEmail = (email) => {
  const candidates = emailLookupCandidates(email);
  if (!candidates.length) return null;
  return User.findOne({ where: { email: { [Op.in]: candidates } }, attributes: ['id', 'email', 'status', 'emailVerified'] });
};

/**
 * Pending, unexpired invites addressed to this member: those already pointed at
 * their account, and those sent to their (verified) email address before they
 * had one. An unverified address does not count: claiming an email you have not
 * proved you control must not let you see who invited its owner.
 */
const pendingInvitesFor = async (user) => {
  const now = new Date();
  const or = [{ guardianId: user.id }];
  if (user.emailVerified) {
    const candidates = emailLookupCandidates(user.email);
    if (candidates.length) or.push({ guardianId: null, inviteEmail: { [Op.in]: candidates } });
  }
  return GuardianLink.findAll({
    where: { status: 'pending', inviteExpiresAt: { [Op.gt]: now }, [Op.or]: or },
    order: [['createdAt', 'DESC']],
  });
};

/** Can this member act on this pending link as the invited guardian? */
const isInvitee = (link, user) => {
  if (link.guardianId) return link.guardianId === user.id;
  if (!user.emailVerified) return false;
  return emailLookupCandidates(user.email).includes(canonicalEmail(link.inviteEmail));
};

const displayName = async (userId) => {
  const p = await Profile.findOne({ where: { userId }, attributes: ['firstName', 'lastName'] });
  return p ? [p.firstName, p.lastName].filter(Boolean).join(' ').trim() : '';
};

/**
 * A new member whose verified email was invited as a guardian before they had
 * an account: tell them, once, that invites are waiting. Best-effort; the
 * invites are also listed on the Guardian page whether or not this runs.
 */
const noticeInvitesOnJoin = async (user) => {
  try {
    if (!user || !user.emailVerified) return 0;
    const links = await pendingInvitesFor(user);
    if (!links.length) return 0;
    const { notify } = require('./notifyUser');
    await notify(
      user.id, 'system', 'You have a guardian invite',
      links.length === 1
        ? 'Someone asked you to be their family guardian. Open Guardian to accept or decline.'
        : `${links.length} people asked you to be their family guardian. Open Guardian to answer.`,
      links[0].id
    );
    return links.length;
  } catch (err) {
    require('../middlewares/logger').log.warn('Could not notify new member of guardian invites', { userId: user && user.id, error: err.message });
    return 0;
  }
};

const inviteLink = (token) => `${config.server.frontendUrl}/guardian?invite=${token}`;

module.exports = {
  MAX_GUARDIANS,
  INVITE_TTL_MS,
  liveLinks,
  staleLinks,
  expireStaleInvites,
  inviteCooldown,
  newInviteToken,
  hashInviteToken,
  findMemberByEmail,
  pendingInvitesFor,
  isInvitee,
  displayName,
  inviteLink,
  noticeInvitesOnJoin,
};
