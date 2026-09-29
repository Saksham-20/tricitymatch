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

module.exports = { preserveEvidence, purgeExpiredEvidence, RETENTION_DAYS };
