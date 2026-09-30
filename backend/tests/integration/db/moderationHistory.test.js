/**
 * Per-member moderation history and audit coverage (audit P2).
 */

jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ success: true }) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('moderation history', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "Reports" WHERE "reportedUserId" IN (:ids) OR "reporterId" IN (:ids)');
      await q('DELETE FROM "MediaReviews" WHERE "userId" IN (:ids)');
      await q('DELETE FROM "Appeals" WHERE "userId" IN (:ids)');
      await q('DELETE FROM "AuditLogs" WHERE "targetUserId" IN (:ids) OR "actorId" IN (:ids)');
    }
    await removeMembers(ids);
  });

  t('joins reports, photo holds, appeals and staff actions into one ordered timeline', async () => {
    const { Report, MediaReview, Appeal, AuditLog } = require('../../../models');
    const { buildModerationHistory } = require('../../../utils/moderationHistory');
    const subject = (await makeMember()).user;
    const reporter = (await makeMember()).user;
    const staff = (await makeMember({ user: { role: 'admin' } })).user;
    ids.push(subject.id, reporter.id, staff.id);

    const report = await Report.create({ reporterId: reporter.id, reportedUserId: subject.id, reason: 'fake_profile', description: 'private words from the reporter' });
    await report.update({ status: 'resolved', adminNotes: 'confirmed', reviewedBy: staff.id, reviewedAt: new Date() });
    const review = await MediaReview.create({ userId: subject.id, url: 'x', source: 'auto', labels: ['Explicit'] });
    await review.update({ status: 'rejected', decidedBy: staff.id, decidedAt: new Date(), decisionNote: 'explicit' });
    await Appeal.create({ userId: subject.id, email: subject.email, statement: 'this was a mistake, please review' });
    await AuditLog.create({ action: 'user_status_changed', actorId: staff.id, targetUserId: subject.id, details: { status: 'suspended' } });

    const history = await buildModerationHistory(subject.id);
    expect(history.summary).toMatchObject({ reportsReceived: 1, reportsResolved: 1, photosHeld: 1, photosRejected: 1, appeals: 1 });
    const kinds = history.timeline.map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['report_received', 'report_decided', 'photo_held', 'photo_decided', 'appeal_submitted', 'staff_action']));
    const times = history.timeline.map((e) => new Date(e.at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(history.timeline.find((e) => e.kind === 'report_decided').byName).toBeTruthy();
    // what the reporter wrote about the member is never echoed back
    expect(JSON.stringify(history)).not.toContain('private words');

    const filedBy = await buildModerationHistory(reporter.id);
    expect(filedBy.summary.reportsFiled).toBe(1);
    expect(filedBy.summary.reportsReceived).toBe(0);
  });

  t('the admin endpoint 404s an unknown member and audits a real read', async () => {
    const { AuditLog } = require('../../../models');
    const { getModerationHistory } = require('../../../controllers/adminController');
    const staff = (await makeMember({ user: { role: 'admin' } })).user;
    const subject = (await makeMember()).user;
    ids.push(staff.id, subject.id);

    const missing = await call(getModerationHistory, { user: staff, params: { userId: '00000000-0000-4000-8000-000000000000' } });
    expect(missing.statusCode).toBe(404);

    const ok = await call(getModerationHistory, { user: staff, params: { userId: subject.id } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.success).toBe(true);
    await new Promise((r) => setTimeout(r, 200));
    const row = await AuditLog.findOne({ where: { action: 'moderation_history_viewed', targetUserId: subject.id } });
    expect(row).toBeTruthy();
    expect(row.actorId).toBe(staff.id);
  });
});
