'use strict';

/**
 * Appeals against a suspension, and staff access to preserved evidence
 * (audit P0-15).
 *
 * A suspended member cannot sign in, so the appeal is a PUBLIC form keyed by
 * email. Whatever the email is — unknown, an active account, a suspended one —
 * the response is the same, so the endpoint cannot be used to learn which
 * addresses are registered or suspended.
 */

const { Op } = require('sequelize');
const { User, Appeal, EvidenceArchive } = require('../models');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');
const { sendEmail } = require('../utils/email');
const { emailLookupCandidates, canonicalEmail } = require('../utils/emailAddress');
const config = require('../config/env');

const GENERIC = {
  success: true,
  message: 'If a suspended account uses this email, your appeal has been received. We will reply by email.',
};

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// POST /api/v1/appeals  (public, rate-limited)
exports.submitAppeal = asyncHandler(async (req, res) => {
  const email = canonicalEmail(req.body.email);
  const statement = String(req.body.statement || '').replace(/<[^>]*>/g, '').trim().slice(0, 2000);
  if (!email || statement.length < 20) throw createError.badRequest('Please give your email and at least a couple of sentences');

  const user = await User.findOne({
    where: { email: { [Op.in]: emailLookupCandidates(email) }, status: { [Op.in]: ['banned', 'inactive'] } },
    attributes: ['id', 'status'],
  });

  if (user) {
    const open = await Appeal.findOne({ where: { userId: user.id, status: 'pending' }, attributes: ['id'] });
    if (!open) {
      const appeal = await Appeal.create({ userId: user.id, email, statement });
      logAudit('appeal_submitted', null, { userId: user.id, appealId: appeal.id });
      sendEmail({
        to: config.email.support,
        channel: 'documents',
        replyTo: email,
        subject: 'Appeal received — suspended account',
        html: `<p>A suspended member has appealed. Open Admin → Appeals.</p><p>${escapeHtml(statement).replace(/\n/g, '<br>')}</p>`,
        text: `A suspended member has appealed. Open Admin -> Appeals.\n\n${statement}`,
      }).catch((err) => log.warn('Appeal email failed (appeal still stored)', { error: err.message, appealId: appeal.id }));
    }
  }

  res.status(202).json(GENERIC);
});

// GET /api/v1/admin/appeals?status=pending|overturned|upheld
exports.listAppeals = asyncHandler(async (req, res) => {
  const status = ['pending', 'overturned', 'upheld'].includes(req.query.status) ? req.query.status : 'pending';
  const appeals = await Appeal.findAll({
    where: { status },
    order: [['createdAt', 'ASC']],
    limit: 100,
    include: [{ model: User, attributes: ['id', 'email', 'status'], required: false }],
  });
  res.json({ success: true, appeals });
});

// PUT /api/v1/admin/appeals/:id  { decision: 'overturned'|'upheld', note }
exports.decideAppeal = asyncHandler(async (req, res) => {
  const { decision, note } = req.body;
  if (!['overturned', 'upheld'].includes(decision)) throw createError.badRequest('decision must be overturned or upheld');
  if (typeof note !== 'string' || note.trim().length < 10) {
    throw createError.badRequest('Write a short note (10+ characters) explaining the decision — the member is sent it');
  }

  const appeal = await Appeal.findByPk(req.params.id);
  if (!appeal) throw createError.notFound('Appeal not found');
  if (appeal.status !== 'pending') throw createError.conflict('This appeal has already been decided');

  appeal.status = decision;
  appeal.decisionNote = note.trim();
  appeal.decidedBy = req.user.id;
  appeal.decidedAt = new Date();
  await appeal.save();

  if (decision === 'overturned' && appeal.userId) {
    // Only lift a suspension; never resurrect an erased account.
    await User.update({ status: 'active' }, { where: { id: appeal.userId, status: { [Op.in]: ['banned', 'inactive'] } } });
  }
  logAudit('appeal_decided', req.user.id, { appealId: appeal.id, targetUserId: appeal.userId, decision });

  sendEmail({
    to: appeal.email,
    channel: 'transactional',
    subject: decision === 'overturned' ? 'Your appeal was successful' : 'About your appeal',
    html: `<p>${decision === 'overturned' ? 'We have reviewed your appeal and restored your account. You can sign in again.' : 'We have reviewed your appeal and are keeping the decision in place.'}</p><p>${escapeHtml(appeal.decisionNote).replace(/\n/g, '<br>')}</p>`,
    text: `${decision === 'overturned' ? 'We have reviewed your appeal and restored your account.' : 'We have reviewed your appeal and are keeping the decision in place.'}\n\n${appeal.decisionNote}`,
  }).catch((err) => log.warn('Appeal decision email failed', { error: err.message, appealId: appeal.id }));

  res.json({ success: true, appeal });
});

// GET /api/v1/admin/evidence?userId=  — metadata only
exports.listEvidence = asyncHandler(async (req, res) => {
  const where = req.query.userId ? { subjectUserId: req.query.userId } : {};
  const rows = await EvidenceArchive.findAll({
    where,
    attributes: ['id', 'subjectUserId', 'reportId', 'reason', 'preserveUntil', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  res.json({ success: true, evidence: rows });
});

// GET /api/v1/admin/evidence/:id — the preserved content; every read is audited.
exports.getEvidence = asyncHandler(async (req, res) => {
  const row = await EvidenceArchive.findByPk(req.params.id);
  if (!row) throw createError.notFound('Evidence not found');
  logAudit('evidence_read', req.user.id, { evidenceId: row.id, targetUserId: row.subjectUserId, reportId: row.reportId });
  res.json({ success: true, evidence: row });
});
