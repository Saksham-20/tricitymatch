/**
 * Guardian Co-Pilot Routes (APP-054)
 * Allows candidates to invite family guardians for read-only profile access.
 * Uses GuardianLinks table (migration 000029).
 */

const express = require('express');
const { param, body } = require('express-validator');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { asyncHandler, AppError } = require('../middlewares/errorHandler');
const { GuardianLink, Profile, User, Match } = require('../models');
const { Op } = require('sequelize');
const { log, logAudit } = require('../middlewares/logger');
const { notify } = require('../utils/notifyUser');
const { matchActionLimiter, sensitiveActionLimiter, passwordResetSubmitLimiter } = require('../middlewares/security');
const { canonicalEmail } = require('../utils/emailAddress');
const { passwordField } = require('../utils/passwordPolicy');
const invites = require('../utils/guardianInvites');
const { issueHandover, completeHandover } = require('../utils/accountHandover');
const { sendGuardianInvite, sendAccountHandover, sendSecurityAlert } = require('../utils/email');
const { ACTIVE_MEMBER_WHERE } = require('../utils/memberRole');
const { blockedIdsFor } = require('../utils/blocks');

// The candidate's own relationship lists, read-only: the same people the
// candidate sees — active members (no staff account, nobody banned or deleted)
// and no one in a block relationship with the candidate.
const candidateRelationshipWhere = async (candidateId, where) => {
  const blocked = [...(await blockedIdsFor(candidateId))];
  return blocked.length ? { ...where, matchedUserId: { [Op.notIn]: blocked } } : where;
};
const matchedMemberInclude = () => ({
  model: User,
  as: 'MatchedUser',
  attributes: ['id'],
  where: ACTIVE_MEMBER_WHERE,
  required: true,
  include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city', 'dateOfBirth'] }],
});

const { handleValidationErrors } = require('../middlewares/errorHandler');

const { MAX_GUARDIANS } = invites;

// :linkId and :candidateId are uuid columns; an arbitrary string otherwise
// reaches Postgres and returns 500 with the driver's error text.
const uuidParam = (name) => [param(name).isUUID(4).withMessage(`Invalid ${name}`), handleValidationErrors];

// ─── Candidate routes ─────────────────────────────────────────────────────────

// GET /guardian/my-guardians — guardians I invited (accepted or still waiting)
router.get('/my-guardians', auth, asyncHandler(async (req, res) => {
  await invites.expireStaleInvites({ candidateId: req.user.id });
  const links = await GuardianLink.findAll({
    where: { candidateId: req.user.id, ...invites.liveLinks() },
    order: [['createdAt', 'ASC']],
  });

  const guardians = links.map(l => ({
    linkId: l.id,
    guardianId: l.guardianId,
    email: l.inviteEmail,
    name: l.guardianName,
    phone: l.guardianPhone,
    relationship: l.relationship,
    status: l.status,
    addedAt: l.createdAt,
    // Only meaningful while the invite is waiting.
    expiresAt: l.status === 'pending' ? l.inviteExpiresAt : null,
  }));

  res.json({ success: true, guardians });
}));

// POST /guardian/invite — invite a guardian by email.
//
// The guardian must accept. The reply is the same whether or not the address
// belongs to a member, so this cannot be used to probe who is registered.
router.post('/invite', auth, matchActionLimiter, asyncHandler(async (req, res) => {
  const { name, phone, relationship } = req.body;
  const email = canonicalEmail(typeof req.body.email === 'string' ? req.body.email : '');
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Valid email required', 400);
  }
  // Optional creator metadata (set when a guardian sets up a candidate profile
  // during onboarding). Trimmed/clamped; ignored for a plain candidate invite.
  const creatorMeta = {
    guardianName: name ? String(name).trim().slice(0, 120) : null,
    guardianPhone: phone ? String(phone).replace(/[^\d+]/g, '').slice(0, 32) : null,
    relationship: relationship ? String(relationship).trim().slice(0, 40) : null,
  };

  // Expired pendings must not hold a slot.
  await invites.expireStaleInvites({ candidateId: req.user.id });

  const activeCount = await GuardianLink.count({
    where: { candidateId: req.user.id, ...invites.liveLinks() },
  });
  if (activeCount >= MAX_GUARDIANS) {
    throw new AppError(`Maximum ${MAX_GUARDIANS} guardians allowed`, 400);
  }

  const existing = await GuardianLink.findOne({
    where: { candidateId: req.user.id, inviteEmail: email, ...invites.liveLinks() },
  });
  if (existing) throw new AppError('This email is already a guardian or has a pending invite', 409);

  // Abuse of outbound mail: revoked/expired invites count here, open ones do not.
  const wait = await invites.inviteCooldown({ candidateId: req.user.id, email });
  if (wait) throw new AppError(wait, 429);

  const guardianUser = await invites.findMemberByEmail(email);

  // Cannot be your own guardian.
  if (guardianUser && guardianUser.id === req.user.id) {
    throw new AppError('Cannot be your own guardian', 400);
  }

  const memberGuardian = guardianUser && guardianUser.status === 'active' ? guardianUser : null;
  const { token, hash } = invites.newInviteToken();
  const link = await GuardianLink.create({
    candidateId: req.user.id,
    // A member is pointed at directly so the invite shows up in their account;
    // a non-member is matched by (verified) email when they join.
    guardianId: memberGuardian ? memberGuardian.id : null,
    inviteEmail: email,
    inviteToken: hash,
    inviteExpiresAt: new Date(Date.now() + invites.INVITE_TTL_MS),
    status: 'pending',
    ...creatorMeta,
  });

  const candidateName = await invites.displayName(req.user.id);
  if (memberGuardian) {
    await notify(
      memberGuardian.id,
      'system',
      'Guardian invite',
      `${candidateName || 'A member'} asked you to be their family guardian. Open Guardian to accept or decline.`,
      link.id
    );
  }
  // Mail everyone, member or not: the reply gives nothing away and a member who
  // is not looking at the app still finds out.
  sendGuardianInvite(email, creatorMeta.guardianName, candidateName, invites.inviteLink(token))
    .catch((err) => log.warn('Guardian invite email failed (invite still stored)', { linkId: link.id, error: err.message }));

  logAudit('guardian_invited', req.user.id, { linkId: link.id });
  log.info('Guardian invite created', { candidateId: req.user.id, linkId: link.id });
  res.json({
    success: true,
    message: 'Invite sent. It stays open for 7 days and they choose whether to accept.',
    method: 'pending',
    linkId: link.id,
  });
}));

// GET /guardian/pending-invites — invites waiting for ME to accept or decline
router.get('/pending-invites', auth, asyncHandler(async (req, res) => {
  const me = await User.findByPk(req.user.id, { attributes: ['id', 'email', 'emailVerified'] });
  const links = await invites.pendingInvitesFor(me);
  const result = [];
  for (const l of links) {
    result.push({
      linkId: l.id,
      candidateName: await invites.displayName(l.candidateId),
      relationship: l.relationship,
      expiresAt: l.inviteExpiresAt,
      invitedAt: l.createdAt,
    });
  }
  res.json({ success: true, invites: result });
}));

const respondToInvite = (decision) => [
  auth, sensitiveActionLimiter, uuidParam('linkId'),
  asyncHandler(async (req, res) => {
    const me = await User.findByPk(req.user.id, { attributes: ['id', 'email', 'emailVerified'] });
    const link = await GuardianLink.findOne({
      where: { id: req.params.linkId, status: 'pending', inviteExpiresAt: { [Op.gt]: new Date() } },
    });
    // One answer for "no such invite", "not yours" and "expired": an id that is
    // not addressed to you tells you nothing.
    if (!link || !invites.isInvitee(link, me)) throw new AppError('Invite not found or expired', 404);
    if (link.candidateId === me.id) throw new AppError('Cannot be your own guardian', 400);

    if (decision === 'accept') {
      await link.update({ guardianId: me.id, inviteToken: null, status: 'active' });
      const guardianName = (await invites.displayName(me.id)) || 'Your guardian';
      await notify(link.candidateId, 'system', 'Guardian accepted', `${guardianName} accepted your guardian invite.`, link.id);
      logAudit('guardian_accepted', me.id, { linkId: link.id, candidateId: link.candidateId });
      return res.json({ success: true, message: 'You are now a guardian', candidateId: link.candidateId });
    }
    await link.update({ guardianId: me.id, inviteToken: null, status: 'revoked' });
    logAudit('guardian_declined', me.id, { linkId: link.id, candidateId: link.candidateId });
    res.json({ success: true, message: 'Invite declined' });
  }),
];
router.post('/:linkId/accept', ...respondToInvite('accept'));
router.post('/:linkId/decline', ...respondToInvite('decline'));

// DELETE /guardian/:linkId — revoke guardian access
//
// Either party may revoke. This was scoped to candidateId only, so a guardian
// who had been linked to someone else's profile — which happens automatically
// when the invited email already belongs to a user, with no accept step — had
// no way to detach themselves from it.
router.delete('/:linkId', auth, matchActionLimiter, uuidParam('linkId'), asyncHandler(async (req, res) => {
  const link = await GuardianLink.findOne({
    where: {
      id: req.params.linkId,
      [Op.or]: [{ candidateId: req.user.id }, { guardianId: req.user.id }],
    },
  });
  if (!link) throw new AppError('Guardian link not found', 404);

  await link.update({ status: 'revoked' });
  res.json({ success: true, message: 'Guardian access revoked' });
}));

// ─── Guardian routes ──────────────────────────────────────────────────────────

// GET /guardian/my-candidates — list candidates whose profiles I can view
router.get('/my-candidates', auth, asyncHandler(async (req, res) => {
  const links = await GuardianLink.findAll({
    where: { guardianId: req.user.id, status: 'active' },
    include: [{
      model: User,
      as: 'Candidate',
      attributes: ['id'],
      include: [{
        model: Profile,
        attributes: ['userId', 'firstName', 'lastName', 'dateOfBirth', 'city', 'completionPercentage'],
      }],
    }],
  });

  const candidates = links.map(l => {
    const p = l.Candidate?.Profile;
    return {
      candidateId: l.candidateId,
      linkId: l.id,
      name: p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown',
      city: p?.city,
      completionPercentage: p?.completionPercentage,
    };
  });

  res.json({ success: true, candidates });
}));

// GET /guardian/candidate/:candidateId/matches — read-only mutual matches for a candidate
router.get('/candidate/:candidateId/matches', auth, uuidParam('candidateId'), asyncHandler(async (req, res) => {
  const { candidateId } = req.params;

  const link = await GuardianLink.findOne({
    where: { candidateId, guardianId: req.user.id, status: 'active' },
  });
  if (!link) throw new AppError('No active guardian access to this candidate', 403);

  const matches = await Match.findAll({
    where: await candidateRelationshipWhere(candidateId, { userId: candidateId, action: 'like', isMutual: true }),
    include: [matchedMemberInclude()],
    limit: 50,
    order: [['createdAt', 'DESC']],
  });

  const result = matches.map(m => {
    const p = m.MatchedUser?.Profile;
    return {
      matchId: m.id,
      userId: m.matchedUserId,
      name: p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown',
      city: p?.city,
    };
  });

  res.json({ success: true, matches: result });
}));

// GET /guardian/candidate/:candidateId/shortlisted — read-only shortlist
router.get('/candidate/:candidateId/shortlisted', auth, uuidParam('candidateId'), asyncHandler(async (req, res) => {
  const { candidateId } = req.params;

  const link = await GuardianLink.findOne({
    where: { candidateId, guardianId: req.user.id, status: 'active' },
  });
  if (!link) throw new AppError('No active guardian access to this candidate', 403);

  const shortlisted = await Match.findAll({
    where: await candidateRelationshipWhere(candidateId, { userId: candidateId, action: 'shortlist' }),
    include: [matchedMemberInclude()],
    limit: 50,
    order: [['createdAt', 'DESC']],
  });

  const result = shortlisted.map(m => {
    const p = m.MatchedUser?.Profile;
    return {
      matchId: m.id,
      userId: m.matchedUserId,
      name: p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown',
      city: p?.city,
    };
  });

  res.json({ success: true, shortlisted: result });
}));

// POST /guardian/resolve-invite/:token — the emailed link. The web Guardian page
// calls it once the invited person is signed in (or has just signed up), which
// is the acceptance: the token only ever went to the invited address.
// Round 1 added this file's sensitiveActionLimiter import and the log-redaction
// prefix, but never applied the limiter to the route — the import sat unused and
// the endpoint kept only the global 200/15m apiLimiter. The :token here is a
// 32-byte bearer secret, so an unthrottled 404-vs-200 oracle is a guessing
// surface however large the token (SEC R2: REGRESSION-1).
router.post('/resolve-invite/:token', auth, sensitiveActionLimiter, asyncHandler(async (req, res) => {
  const { token } = req.params;

  const link = await GuardianLink.findOne({
    where: {
      inviteToken: invites.hashInviteToken(token),
      status: 'pending',
      inviteExpiresAt: { [Op.gt]: new Date() },
    },
  });

  if (!link) throw new AppError('Invalid or expired invite token', 404);

  // Prevent self-guardian
  if (link.candidateId === req.user.id) throw new AppError('Cannot be your own guardian', 400);

  await link.update({ guardianId: req.user.id, inviteToken: null, status: 'active' });
  await notify(link.candidateId, 'system', 'Guardian accepted', 'Your guardian invite was accepted.', link.id);
  logAudit('guardian_accepted', req.user.id, { linkId: link.id, candidateId: link.candidateId, via: 'token' });
  res.json({ success: true, message: 'Guardian access accepted', candidateId: link.candidateId });
}));

// ─── Hand-over of a profile someone else set up ───────────────────────────────

// POST /guardian/handover — the person who runs this account names its owner.
// Re-entering the password stops a borrowed or hijacked session from giving the
// account away.
router.post('/handover', auth, sensitiveActionLimiter,
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isString().isLength({ min: 1, max: 128 }),
  body('ownerName').optional({ nullable: true }).isString().isLength({ max: 120 }),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const manager = await User.findByPk(req.user.id);
    if (!manager.password) throw new AppError('Set a password on this account before handing it over.', 400);
    if (!(await manager.comparePassword(req.body.password))) throw new AppError('Password is incorrect', 401);

    const managerName = await invites.displayName(manager.id);
    const { link, email } = await issueHandover({ managerUser: manager, ownerEmail: req.body.email, managerName });
    const ownerName = req.body.ownerName ? String(req.body.ownerName).trim().slice(0, 120) : '';

    await sendAccountHandover(email, ownerName, managerName, link).catch((err) => {
      log.warn('Hand-over email failed', { userId: manager.id, error: err.message });
      throw new AppError('We could not send the email. Check the address and try again.', 502);
    });
    logAudit('account_handover_started', manager.id, {});
    res.json({ success: true, message: 'We sent the owner a link. It works once and expires in 7 days.' });
  }));

// POST /guardian/handover/complete — the owner opens the emailed link (no
// session: they do not have an account yet) and chooses their own password.
router.post('/handover/complete', passwordResetSubmitLimiter,
  body('token').isString().isLength({ min: 32, max: 128 }),
  passwordField('password'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const result = await completeHandover({ token: req.body.token, password: req.body.password });
    if (result.previousEmail) {
      sendSecurityAlert(result.previousEmail, '', 'Profile handed over',
        'The profile you set up on TricityMatch was taken over by its owner. You no longer have access to it.', new Date().toISOString())
        .catch(() => {});
    }
    logAudit('account_handover_completed', result.userId, {});
    res.json({ success: true, message: 'Your profile is yours now. Sign in with your email and new password.' });
  }));

module.exports = router;
