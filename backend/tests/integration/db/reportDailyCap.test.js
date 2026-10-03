/** SAFE-06: a daily ceiling on new reports per member, and no duplicate pending photo reviews. */
jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('report daily cap and photo-queue dedupe', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      await sequelize.query('DELETE FROM "MediaReviews" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
      await sequelize.query('DELETE FROM "Reports" WHERE "reporterId" IN (:ids) OR "reportedUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });
  const member = async (o) => { const m = await makeMember(o); ids.push(m.user.id); return m.user; };
  const report = (from, to, body) => call(require('../../../controllers/blockReportController').reportUser, { user: from, params: { userId: to.id }, body });

  t('an 11th new report in a day is refused; reports stay available the next day', async () => {
    const { Report } = require('../../../models');
    const me = await member();
    for (let i = 0; i < 10; i += 1) {
      const other = await member();
      expect((await report(me, other, { reason: 'spam' })).statusCode).toBe(201);
    }
    const extra = await member();
    const res = await report(me, extra, { reason: 'spam' });
    expect(res.statusCode).toBe(429);
    expect(await Report.count({ where: { reporterId: me.id, reportedUserId: extra.id } })).toBe(0);

    await Report.update({ createdAt: new Date(Date.now() - 25 * 3600 * 1000) }, { where: { reporterId: me.id } });
    expect((await report(me, extra, { reason: 'spam' })).statusCode).toBe(201);
  });

  t('a second stolen-photo report does not queue the same photo twice', async () => {
    const { MediaReview, Report } = require('../../../models');
    const subject = await member({ profile: { profilePhoto: 'https://img.test/a.jpg', photos: ['https://img.test/a.jpg', 'https://img.test/b.jpg'] } });
    const r1 = await member(); const r2 = await member();
    expect((await report(r1, subject, { reason: 'stolen_photos' })).statusCode).toBe(201);
    expect((await report(r2, subject, { reason: 'stolen_photos' })).statusCode).toBe(201);
    expect(await Report.count({ where: { reportedUserId: subject.id } })).toBe(2);
    expect(await MediaReview.count({ where: { userId: subject.id, status: 'pending' } })).toBe(2);
  });
});
