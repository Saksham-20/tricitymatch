'use strict';

/**
 * Filing the "underage" review reports for members whose stored date of birth is
 * below the marriageable-age minimum. Used by scripts/flag-underage-members.js.
 *
 * These reports are system-filed under an admin account (reports need a
 * reporter). They are created exactly as a member's underage report would be -
 * urgent, with an escalation time - so they sort to the top of the queue, and
 * they are marked so that working them does not send "Your report has been
 * updated" to the admin who happens to be the stand-in reporter.
 */

const { Op } = require('sequelize');

const SYSTEM_REVIEW_PREFIX = 'System review:';

const isSystemReview = (report) =>
  typeof report?.description === 'string' && report.description.startsWith(SYSTEM_REVIEW_PREFIX);

/**
 * @param {object} o
 * @param {{ id: string }} o.reporter
 * @param {Array<{ p: { userId: string, gender?: string }, age: number, min: number }>} o.under
 * @param {object} o.Report  the Report model
 * @returns {Promise<number>} reports filed (members with one already open are skipped)
 */
const fileUnderageReports = async ({ reporter, under, Report }) => {
  let filed = 0;
  for (const { p, age, min } of under) {
    const open = await Report.findOne({
      where: { reportedUserId: p.userId, reason: 'underage', status: { [Op.in]: ['pending', 'reviewing'] } },
      attributes: ['id'],
    });
    if (open) continue;
    await Report.create({
      reporterId: reporter.id,
      reportedUserId: p.userId,
      reason: 'underage',
      priority: 'urgent',
      escalatedAt: new Date(),
      description: `${SYSTEM_REVIEW_PREFIX} date of birth on file gives age ${age}, below the ${min}-year minimum for gender "${p.gender || 'unknown'}".`,
      status: 'pending',
    });
    filed += 1;
  }
  return filed;
};

module.exports = { SYSTEM_REVIEW_PREFIX, isSystemReview, fileUnderageReports };
