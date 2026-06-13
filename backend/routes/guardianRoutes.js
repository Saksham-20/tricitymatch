/**
 * Guardian Co-Pilot Routes (APP-054)
 * Allows candidates to invite family guardians for read-only profile access.
 * Uses GuardianLinks table (migration 000029).
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { auth } = require('../middlewares/auth');
const { asyncHandler, AppError } = require('../middlewares/errorHandler');
const { GuardianLink, Profile, User, Match } = require('../models');
const { Op } = require('sequelize');
const { log } = require('../middlewares/logger');
const { notify } = require('../utils/notifyUser');

const MAX_GUARDIANS = 3;

// ─── Candidate routes ─────────────────────────────────────────────────────────

// GET /guardian/my-guardians — list active guardians I invited
router.get('/my-guardians', auth, asyncHandler(async (req, res) => {
  const links = await GuardianLink.findAll({
    where: { candidateId: req.user.id, status: ['pending', 'active'] },
    include: [{ model: User, as: 'Guardian', attributes: ['id', 'email'] }],
    order: [['createdAt', 'ASC']],
  });

  const guardians = links.map(l => ({
    linkId: l.id,
    guardianId: l.guardianId,
    email: l.inviteEmail,
    status: l.status,
    addedAt: l.createdAt,
  }));

  res.json({ success: true, guardians });
}));

// POST /guardian/invite — invite a guardian by email
router.post('/invite', auth, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Valid email required', 400);
  }

  // Count active/pending guardians
  const activeCount = await GuardianLink.count({
    where: { candidateId: req.user.id, status: ['pending', 'active'] },
  });
  if (activeCount >= MAX_GUARDIANS) {
    throw new AppError(`Maximum ${MAX_GUARDIANS} guardians allowed`, 400);
  }

  // Check for duplicate
  const existing = await GuardianLink.findOne({
    where: { candidateId: req.user.id, inviteEmail: email, status: ['pending', 'active'] },
  });
  if (existing) throw new AppError('This email is already a guardian or has a pending invite', 409);

  const guardianUser = await User.findOne({ where: { email } });

  if (guardianUser) {
    // User already on platform — link directly as active
    const link = await GuardianLink.create({
      candidateId: req.user.id,
      guardianId: guardianUser.id,
      inviteEmail: email,
      status: 'active',
    });

    await notify(
      guardianUser.id,
      'system',
      'Guardian access granted',
      'You have been given read-only guardian access to a candidate\'s profile on TricityShadi.'
    );

    log.info('Guardian linked directly', { candidateId: req.user.id, guardianId: guardianUser.id });
    res.json({ success: true, message: 'Guardian linked', method: 'direct', linkId: link.id });
  } else {
    // Not on platform — store pending invite with expiry token
    const token = crypto.randomBytes(32).toString('hex');
    const link = await GuardianLink.create({
      candidateId: req.user.id,
      guardianId: null,
      inviteEmail: email,
      inviteToken: token,
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      status: 'pending',
    });

    log.info('Guardian invite created (user not on platform)', { candidateId: req.user.id, email });
    res.json({
      success: true,
      message: 'Invite stored — they will see the link when they join TricityShadi',
      method: 'pending',
      linkId: link.id,
    });
  }
}));

// DELETE /guardian/:linkId — revoke guardian access
router.delete('/:linkId', auth, asyncHandler(async (req, res) => {
  const link = await GuardianLink.findOne({
    where: { id: req.params.linkId, candidateId: req.user.id },
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
router.get('/candidate/:candidateId/matches', auth, asyncHandler(async (req, res) => {
  const { candidateId } = req.params;

  const link = await GuardianLink.findOne({
    where: { candidateId, guardianId: req.user.id, status: 'active' },
  });
  if (!link) throw new AppError('No active guardian access to this candidate', 403);

  const matches = await Match.findAll({
    where: { userId: candidateId, action: 'like', isMutual: true },
    include: [{
      model: User,
      as: 'MatchedUser',
      attributes: ['id'],
      include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city', 'dateOfBirth'] }],
    }],
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
router.get('/candidate/:candidateId/shortlisted', auth, asyncHandler(async (req, res) => {
  const { candidateId } = req.params;

  const link = await GuardianLink.findOne({
    where: { candidateId, guardianId: req.user.id, status: 'active' },
  });
  if (!link) throw new AppError('No active guardian access to this candidate', 403);

  const shortlisted = await Match.findAll({
    where: { userId: candidateId, action: 'shortlist' },
    include: [{
      model: User,
      as: 'MatchedUser',
      attributes: ['id'],
      include: [{ model: Profile, attributes: ['firstName', 'lastName', 'city', 'dateOfBirth'] }],
    }],
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

// POST /guardian/resolve-invite/:token — called when a new user joins and has a pending invite
// (triggered from authController after signup, optional — links pending invites to new account)
router.post('/resolve-invite/:token', auth, asyncHandler(async (req, res) => {
  const { token } = req.params;

  const link = await GuardianLink.findOne({
    where: {
      inviteToken: token,
      status: 'pending',
      inviteExpiresAt: { [Op.gt]: new Date() },
    },
  });

  if (!link) throw new AppError('Invalid or expired invite token', 404);

  // Prevent self-guardian
  if (link.candidateId === req.user.id) throw new AppError('Cannot be your own guardian', 400);

  await link.update({ guardianId: req.user.id, inviteToken: null, status: 'active' });
  res.json({ success: true, message: 'Guardian access accepted', candidateId: link.candidateId });
}));

module.exports = router;
