'use strict';

/**
 * Keep what a moderation report rests on after the reported member erases their
 * account or an admin hard-deletes them.
 *
 * The Terms promise moderation records are retained; in practice erasure
 * tombstones the reported member's messages and destroys their profile, and an
 * admin hard-delete cascades their Reports away — so a member could remove the
 * evidence against them by deleting their account. Before either happens, this
 * snapshots, per report against them: the report itself, the messages
 * exchanged between reporter and reported, and the profile text. Kept 180 days
 * (the Terms figure), then purged by the evidence-purge job.
 *
 * Runs inside the caller's transaction so the snapshot and the erasure commit
 * or roll back together.
 */

const { Op } = require('sequelize');

const RETENTION_DAYS = 180;
const MESSAGE_CAP = 300;

const preserveEvidence = async (userIds, transaction, { models }) => {
  const { Report, Message, Profile, EvidenceArchive } = models;
  const ids = [...new Set(userIds)];
  if (!ids.length) return { archived: 0 };

  const reports = await Report.findAll({ where: { reportedUserId: { [Op.in]: ids } }, transaction });
  if (!reports.length) return { archived: 0 };

  const profiles = await Profile.findAll({
    where: { userId: { [Op.in]: ids } },
    attributes: ['userId', 'firstName', 'lastName', 'bio', 'city', 'profilePrompts'],
    raw: true,
    transaction,
  });
  const profileOf = new Map(profiles.map((p) => [p.userId, p]));
  const preserveUntil = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

  let archived = 0;
  for (const report of reports) {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: report.reportedUserId, receiverId: report.reporterId },
          { senderId: report.reporterId, receiverId: report.reportedUserId },
        ],
      },
      attributes: ['id', 'senderId', 'receiverId', 'content', 'messageType', 'mediaUrl', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: MESSAGE_CAP,
      raw: true,
      transaction,
    });

    await EvidenceArchive.create({
      subjectUserId: report.reportedUserId,
      reportId: report.id,
      reason: report.reason,
      preserveUntil,
      payload: {
        report: {
          id: report.id,
          reporterId: report.reporterId,
          reason: report.reason,
          description: report.description,
          status: report.status,
          createdAt: report.createdAt,
        },
        messages: messages.reverse(),
        subjectProfile: profileOf.get(report.reportedUserId) || null,
      },
    }, { transaction });
    archived += 1;
  }
  return { archived };
};

const purgeExpiredEvidence = async (models, now = new Date()) => {
  const { EvidenceArchive } = models;
  const removed = await EvidenceArchive.destroy({ where: { preserveUntil: { [Op.lt]: now } } });
  return { removed };
};

const SNAPSHOT_MESSAGES = 50;
const MESSAGE_ATTRS = ['id', 'senderId', 'receiverId', 'content', 'messageType', 'mediaUrl', 'createdAt'];
const retentionDate = () => new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

/**
 * When a report is FILED, copy the recent conversation between reporter and
 * reported into the evidence archive. Until now evidence was taken only when the
 * reported member erased their account, so the message-level proof of a harassment
 * report existed only for as long as the other person chose to leave it: the sender
 * could delete or edit the messages the moment they saw the report. The reporter
 * putting these messages in front of staff is the point of reporting, so no extra
 * consent is needed. Best-effort: the caller must not fail the report if this does.
 */
const snapshotReportEvidence = async (report, models) => {
  const { Message, EvidenceArchive } = models;
  const messages = await Message.findAll({
    where: {
      [Op.or]: [
        { senderId: report.reportedUserId, receiverId: report.reporterId },
        { senderId: report.reporterId, receiverId: report.reportedUserId },
      ],
    },
    attributes: MESSAGE_ATTRS,
    order: [['createdAt', 'DESC']],
    limit: SNAPSHOT_MESSAGES,
    raw: true,
  });
  if (!messages.length) return { archived: 0 };
  await EvidenceArchive.create({
    subjectUserId: report.reportedUserId,
    reportId: report.id,
    reason: report.reason,
    preserveUntil: retentionDate(),
    payload: {
      source: 'report_filed',
      report: {
        id: report.id,
        reporterId: report.reporterId,
        reason: report.reason,
        description: report.description,
        createdAt: report.createdAt,
      },
      messages: messages.reverse(),
    },
  });
  return { archived: 1 };
};

/**
 * While a report between two members is open, a message either of them deletes
 * or edits is archived first (what it said, who sent it, what happened to it), so
 * the proof cannot be removed after the fact. With no open report nothing is
 * kept: ordinary deletes still really delete.
 */
const keepMessageIfReported = async (message, change, models) => {
  const { Report, EvidenceArchive } = models;
  const open = await Report.findOne({
    where: {
      status: { [Op.in]: ['pending', 'reviewing'] },
      [Op.or]: [
        { reporterId: message.senderId, reportedUserId: message.receiverId },
        { reporterId: message.receiverId, reportedUserId: message.senderId },
      ],
    },
    attributes: ['id', 'reportedUserId', 'reason'],
  });
  if (!open) return false;
  await EvidenceArchive.create({
    subjectUserId: message.senderId,
    reportId: open.id,
    reason: `message_${change}_during_report`,
    preserveUntil: retentionDate(),
    payload: {
      source: `message_${change}`,
      at: new Date().toISOString(),
      message: {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        messageType: message.messageType,
        mediaUrl: message.mediaUrl,
        createdAt: message.createdAt,
      },
    },
  });
  return true;
};

module.exports = { preserveEvidence, purgeExpiredEvidence, snapshotReportEvidence, keepMessageIfReported, RETENTION_DAYS };
