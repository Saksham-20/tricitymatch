'use strict';

/**
 * One member's moderation record, oldest to newest (audit P2).
 *
 * A reviewer deciding on a report used to see the last ten reports against the
 * member and nothing else: not whether a photo had been pulled before, whether
 * a suspension was already appealed, or who changed what. This stitches the
 * separate tables into one timeline so a repeat pattern is visible.
 *
 * Read-only. Free text written by other members (report descriptions) is
 * never returned; only staff notes and machine labels are.
 */

const { Report, MediaReview, Appeal, AuditLog, User, Profile } = require('../models');

const LIMIT = 100;

const toEntry = (at, kind, summary, extra = {}) => ({ at, kind, summary, ...extra });

const buildModerationHistory = async (userId) => {
  const [received, filed, media, appeals, audits] = await Promise.all([
    Report.findAll({
      where: { reportedUserId: userId },
      attributes: ['id', 'reason', 'status', 'adminNotes', 'reviewedBy', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
      limit: LIMIT,
    }),
    Report.count({ where: { reporterId: userId } }),
    MediaReview.findAll({
      where: { userId },
      attributes: ['id', 'source', 'status', 'labels', 'decisionNote', 'decidedBy', 'decidedAt', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: LIMIT,
    }),
    Appeal.findAll({
      where: { userId },
      attributes: ['id', 'status', 'decisionNote', 'decidedBy', 'decidedAt', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: LIMIT,
    }),
    AuditLog.findAll({
      where: { targetUserId: userId },
      attributes: ['id', 'action', 'actorId', 'details', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: LIMIT,
    }),
  ]);

  const timeline = [];
  for (const r of received) {
    timeline.push(toEntry(r.createdAt, 'report_received', `Reported for ${r.reason}`, { id: r.id, status: r.status }));
    if (r.status !== 'pending' && r.updatedAt && r.updatedAt > r.createdAt) {
      timeline.push(toEntry(r.updatedAt, 'report_decided', `Report marked ${r.status}`, {
        id: r.id, by: r.reviewedBy || null, note: r.adminNotes || null,
      }));
    }
  }
  for (const m of media) {
    timeline.push(toEntry(m.createdAt, 'photo_held', `Photo held (${m.source})`, { id: m.id, labels: m.labels }));
    if (m.decidedAt) {
      timeline.push(toEntry(m.decidedAt, 'photo_decided', `Photo ${m.status}`, {
        id: m.id, by: m.decidedBy || null, note: m.decisionNote || null,
      }));
    }
  }
  for (const a of appeals) {
    timeline.push(toEntry(a.createdAt, 'appeal_submitted', 'Appeal submitted', { id: a.id }));
    if (a.decidedAt) {
      timeline.push(toEntry(a.decidedAt, 'appeal_decided', `Appeal ${a.status}`, {
        id: a.id, by: a.decidedBy || null, note: a.decisionNote || null,
      }));
    }
  }
  for (const e of audits) {
    timeline.push(toEntry(e.createdAt, 'staff_action', e.action, { id: e.id, by: e.actorId || null, details: e.details || null }));
  }

  timeline.sort((x, y) => new Date(x.at) - new Date(y.at));

  const staffIds = [...new Set(timeline.map((t) => t.by).filter(Boolean))];
  const staff = staffIds.length
    ? await User.findAll({
      where: { id: staffIds },
      attributes: ['id', 'email'],
      include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }],
    })
    : [];
  const names = Object.fromEntries(staff.map((s) => [
    s.id,
    [s.Profile?.firstName, s.Profile?.lastName].filter(Boolean).join(' ') || s.email,
  ]));

  return {
    summary: {
      reportsReceived: received.length,
      reportsResolved: received.filter((r) => r.status === 'resolved').length,
      reportsFiled: filed,
      photosHeld: media.length,
      photosRejected: media.filter((m) => m.status === 'rejected').length,
      appeals: appeals.length,
    },
    timeline: timeline.map((t) => ({ ...t, byName: t.by ? names[t.by] || null : null })),
  };
};

module.exports = { buildModerationHistory };
