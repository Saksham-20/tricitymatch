'use strict';

/**
 * Appeals against a suspension, and staff access to preserved evidence
 * (audit P0-15).
 *
 * A suspended member cannot sign in, so the appeal is a PUBLIC form keyed by
 * the account's email or mobile number (members who joined by phone have no
 * email). Whatever the email or number is — unknown, an active account, a
 * suspended one — the response is the same, so the endpoint cannot be used to
 * learn which addresses or numbers are registered or suspended.
 */

const { Op } = require('sequelize');
const { User, Appeal, EvidenceArchive } = require('../models');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');
const { sendEmail } = require('../utils/email');
const { staffAlertRecipients } = require('../utils/staffAlerts');
const { emailLookupCandidates, canonicalEmail } = require('../utils/emailAddress');
const config = require('../config/env');

const GENERIC = {
  success: true,
  message: 'If a suspended account uses this email or mobile number, your appeal has been received. A person will read it and reply.',
};

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The ten-digit mobile number however it was typed (+91, a leading 0, spaces),
// or null when it cannot be an Indian mobile.
const appealPhone = (raw) => {
  if (raw === undefined || raw === null) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

// Numbers are stored as ten digits today; older rows may carry a prefix.
const storedPhoneForms = (phone10) => [phone10, `91${phone10}`, `+91${phone10}`, `0${phone10}`];

// Ordinary members only. A suspended staff or marketing account is restored
// through the team tools, which carry rank and scope checks an appeal skips.
const SUSPENDED_MEMBER = { status: { [Op.in]: ['banned', 'inactive'] }, role: 'user' };
const APPELLANT_FIELDS = ['id', 'status', 'email', 'emailVerified'];

const findAppellant = async ({ email, phone }) => {
  if (email) {
    return User.findOne({
      where: { email: { [Op.in]: emailLookupCandidates(email) }, ...SUSPENDED_MEMBER },
      attributes: APPELLANT_FIELDS,
    });
  }
  // The number the account signs in with comes first. A separate contact number
  // can sit on more than one account (a parent's, say), so it is the fallback,
  // and the account changed most recently (the suspension) wins.
  const forms = storedPhoneForms(phone);
  const bySignIn = await User.findOne({
    where: { phone: { [Op.in]: forms }, ...SUSPENDED_MEMBER },
    attributes: APPELLANT_FIELDS,
  });
  if (bySignIn) return bySignIn;
  return User.findOne({
    where: { contactPhone: { [Op.in]: forms }, ...SUSPENDED_MEMBER },
    attributes: APPELLANT_FIELDS,
    order: [['updatedAt', 'DESC']],
  });
};

// POST /api/v1/appeals  (public, rate-limited)
exports.submitAppeal = asyncHandler(async (req, res) => {
  const email = canonicalEmail(req.body.email);
  const phone = email ? null : appealPhone(req.body.phone);
  const statement = String(req.body.statement || '').replace(/<[^>]*>/g, '').trim().slice(0, 2000);
  if ((!email && !phone) || statement.length < 20) {
    throw createError.badRequest('Please give the email or mobile number of your account and at least a couple of sentences');
  }

  const user = await findAppellant({ email, phone });

  if (!user) {
    // The logger stores the address or number as a short hash, never as typed.
    log.info('Appeal did not match a suspended member', email ? { email } : { phone });
  } else {
    const open = await Appeal.findOne({ where: { userId: user.id, status: 'pending' }, attributes: ['id'] });
    if (!open) {
      // Where the decision goes. An appeal by mobile is answered at the account's
      // email only when the member proved it; otherwise the reviewer sees the
      // number and replies by phone.
      const replyEmail = email || (user.emailVerified === true && user.email) || null;
      const contact = replyEmail || `+91${phone}`;
      const appeal = await Appeal.create({ userId: user.id, email: contact, statement });
      logAudit('appeal_submitted', null, { userId: user.id, appealId: appeal.id, via: email ? 'email' : 'phone' });
      const noEmail = replyEmail ? '' : `The account has no confirmed email. Reply on ${contact} by phone or WhatsApp.`;
      sendEmail({
        to: staffAlertRecipients(),
        channel: 'documents',
        ...(replyEmail ? { replyTo: replyEmail } : {}),
        subject: 'Appeal received — suspended account',
        html: `<p>A suspended member has appealed. Open Admin → Appeals.</p>${noEmail ? `<p>${escapeHtml(noEmail)}</p>` : ''}<p>${escapeHtml(statement).replace(/\n/g, '<br>')}</p>`,
        text: `A suspended member has appealed. Open Admin -> Appeals.${noEmail ? `\n${noEmail}` : ''}\n\n${statement}`,
      }).catch((err) => log.warn('Appeal email failed (appeal still stored)', { error: err.message, appealId: appeal.id }));
    }
  }

  res.status(202).json(GENERIC);
});

/**
 * What each appellant was suspended for, so the reviewer reads the original
 * reason beside the appeal. It comes from the audit trail: a single status change
 * records the reason the admin typed, a bulk change records none. The latest
 * suspension sent before the appeal counts (a later one is a separate matter).
 */
const suspensionsFor = async (appeals) => {
  const ids = [...new Set(appeals.map((a) => a.userId).filter(Boolean))];
  if (!ids.length) return new Map();
  const { sequelize } = Appeal;
  const rows = await sequelize.query(
    `SELECT a."targetUserId"::text AS "userId", a.details->>'newStatus' AS status,
            a.details->>'reason' AS reason, a."createdAt", u.email AS "byEmail", false AS bulk
       FROM "AuditLogs" a
       LEFT JOIN "Users" u ON u.id = a."actorId"
      WHERE a.action = 'user_status_changed'
        AND a."targetUserId" IN (:ids)
        AND a.details->>'newStatus' IN ('banned', 'inactive')
     UNION ALL
     SELECT x.uid AS "userId", a.details->>'status' AS status,
            NULL AS reason, a."createdAt", u.email AS "byEmail", true AS bulk
       FROM "AuditLogs" a
       CROSS JOIN LATERAL jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(a.details->'ids') = 'array' THEN a.details->'ids' ELSE '[]'::jsonb END
       ) AS x(uid)
       LEFT JOIN "Users" u ON u.id = a."actorId"
      WHERE a.action = 'users_bulk_status_changed'
        AND a.details->>'status' IN ('banned', 'inactive')
        AND x.uid IN (:ids)
      ORDER BY "createdAt" DESC`,
    { replacements: { ids }, type: sequelize.QueryTypes.SELECT }
  );
  const byAppeal = new Map();
  for (const appeal of appeals) {
    const sentAt = new Date(appeal.createdAt).getTime();
    const hit = rows.find((r) => r.userId === appeal.userId && new Date(r.createdAt).getTime() <= sentAt);
    if (hit) {
      byAppeal.set(appeal.id, {
        status: hit.status,
        reason: hit.reason || null,
        at: hit.createdAt,
        byEmail: hit.byEmail || null,
        bulk: Boolean(hit.bulk),
      });
    }
  }
  return byAppeal;
};

// GET /api/v1/admin/appeals?status=pending|overturned|upheld
exports.listAppeals = asyncHandler(async (req, res) => {
  const { Profile } = require('../models');
  const status = ['pending', 'overturned', 'upheld'].includes(req.query.status) ? req.query.status : 'pending';
  const appeals = await Appeal.findAll({
    where: { status },
    // Waiting appeals oldest first; decided ones newest first, so the latest
    // decisions are always on the page.
    order: status === 'pending' ? [['createdAt', 'ASC']] : [['decidedAt', 'DESC NULLS LAST'], ['createdAt', 'DESC']],
    limit: 100,
    include: [{
      model: User,
      attributes: ['id', 'email', 'phone', 'status'],
      required: false,
      include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }],
    }],
  });
  const suspensions = await suspensionsFor(appeals);
  res.json({
    success: true,
    appeals: appeals.map((a) => ({ ...a.toJSON(), suspension: suspensions.get(a.id) || null })),
  });
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

  // Restoring is a status change on the account, so it follows the same rule as
  // one: only ordinary members here. (Staff status goes through updateUserStatus,
  // which enforces rank, self-edit and team-scope guards.)
  if (decision === 'overturned' && appeal.userId) {
    const subject = await User.findByPk(appeal.userId, { attributes: ['id', 'role'] });
    if (subject && subject.role !== 'user') {
      throw createError.forbidden('This account is not an ordinary member. Restore it from Admin > Team.');
    }
  }

  appeal.status = decision;
  appeal.decisionNote = note.trim();
  appeal.decidedBy = req.user.id;
  appeal.decidedAt = new Date();
  await appeal.save();

  if (decision === 'overturned' && appeal.userId) {
    // Only lift a suspension; never resurrect an erased account.
    await User.update({ status: 'active' }, { where: { id: appeal.userId, role: 'user', status: { [Op.in]: ['banned', 'inactive'] } } });
  }
  logAudit('appeal_decided', req.user.id, { appealId: appeal.id, targetUserId: appeal.userId, decision });

  // An appeal sent with only a mobile number has no address to write to; the
  // review screen tells the reviewer to give the decision by phone instead.
  const emailed = typeof appeal.email === 'string' && appeal.email.includes('@');
  if (emailed) {
    sendEmail({
      to: appeal.email,
      channel: 'transactional',
      subject: decision === 'overturned' ? 'Your appeal was successful' : 'About your appeal',
      html: `<p>${decision === 'overturned' ? 'We have reviewed your appeal and restored your account. You can sign in again.' : 'We have reviewed your appeal and are keeping the decision in place.'}</p><p>${escapeHtml(appeal.decisionNote).replace(/\n/g, '<br>')}</p>`,
      text: `${decision === 'overturned' ? 'We have reviewed your appeal and restored your account.' : 'We have reviewed your appeal and are keeping the decision in place.'}\n\n${appeal.decisionNote}`,
    }).catch((err) => log.warn('Appeal decision email failed', { error: err.message, appealId: appeal.id }));
  }

  res.json({ success: true, appeal, emailed });
});

const EVIDENCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/v1/admin/evidence?userId=&reportId=  — metadata only (no content)
// userId: everything kept about that member; reportId: everything kept for one report.
exports.listEvidence = asyncHandler(async (req, res) => {
  const where = {};
  for (const [param, column] of [['userId', 'subjectUserId'], ['reportId', 'reportId']]) {
    const value = req.query[param];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string' || !EVIDENCE_ID.test(value)) throw createError.badRequest(`${param} must be a valid id`);
    where[column] = value;
  }
  const { sequelize } = EvidenceArchive;
  const rows = await EvidenceArchive.findAll({
    where,
    attributes: [
      'id', 'subjectUserId', 'reportId', 'reason', 'preserveUntil', 'createdAt',
      // Enough to tell the records apart before opening one (opening is audited).
      [sequelize.literal(`"payload"->>'source'`), 'source'],
      [sequelize.literal(`CASE WHEN jsonb_typeof("payload"->'messages') = 'array' THEN jsonb_array_length("payload"->'messages')
                               WHEN "payload"->'message' IS NOT NULL THEN 1 ELSE 0 END`), 'messageCount'],
    ],
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
