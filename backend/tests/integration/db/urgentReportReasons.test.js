/**
 * Reports the Terms promise to act on within 24 hours: someone else's or
 * doctored photos (impersonation) and nude or sexual images. They are urgent
 * now, like threats: first in the queue and mailed to staff at once, to the
 * support address AND the on-call alert list, each address once.
 */

// Set before anything loads the (frozen) config.
process.env.ALERT_EMAILS = 'Safety@Example.com, support@tricitymatch.com , safety@example.com';

jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn(async () => ({ success: true })) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

const STAFF = ['support@tricitymatch.com', 'safety@example.com'];

describeDb('urgent report reasons', (t) => {
  const ids = [];
  let sendEmail; let Report;

  beforeAll(() => {
    ({ sendEmail } = require('../../../utils/email'));
    ({ Report } = require('../../../models'));
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "MediaReviews" WHERE "userId" IN (:ids)');
      await q('DELETE FROM "EvidenceArchives" WHERE "subjectUserId" IN (:ids)');
      await q('DELETE FROM "Reports" WHERE "reporterId" IN (:ids) OR "reportedUserId" IN (:ids)');
    }
    await removeMembers(ids);
  });

  const member = async (o) => { const m = await makeMember(o); ids.push(m.user.id); return m.user; };
  const report = (from, to, reason) => call(require('../../../controllers/blockReportController').reportUser, {
    user: from, params: { userId: to.id }, body: { reason, description: 'Details for the safety team.' },
  });

  t('a stolen-photo report is urgent and mails staff straight away', async () => {
    const reporter = await member();
    const subject = await member({ profile: { profilePhoto: 'https://img.test/x.jpg', photos: ['https://img.test/x.jpg'] } });

    const res = await report(reporter, subject, 'stolen_photos');

    expect(res.statusCode).toBe(201);
    const row = await Report.findByPk(res.body.reportId);
    expect(row.priority).toBe('urgent');
    expect(row.escalatedAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toEqual(STAFF);
    expect(mail.subject).toBe('URGENT report: stolen photos');
  });

  t('a report of nude or sexual images (inappropriate content) is urgent too', async () => {
    const reporter = await member();
    const subject = await member();

    const res = await report(reporter, subject, 'inappropriate_content');

    expect((await Report.findByPk(res.body.reportId)).priority).toBe('urgent');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: STAFF, subject: 'URGENT report: inappropriate content' });
  });

  t('threats still go to the same recipients; spam stays normal and mails nobody', async () => {
    const reporter = await member();
    const threatened = await member();
    const spammer = await member();

    await report(reporter, threatened, 'threats');
    expect(sendEmail.mock.calls[0][0].to).toEqual(STAFF);

    sendEmail.mockClear();
    const res = await report(reporter, spammer, 'spam');
    expect((await Report.findByPk(res.body.reportId)).priority).toBe('normal');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
