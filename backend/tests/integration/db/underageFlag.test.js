/** SAFE-17: system underage reports are urgent and do not notify the stand-in reporter. */
const mockNotify = jest.fn(async () => {});
jest.mock('../../../utils/notifyUser', () => ({ notify: (...a) => mockNotify(...a) }));
jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('underage sweep reports', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "Reports" WHERE "reporterId" IN (:ids) OR "reportedUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });
  beforeEach(() => mockNotify.mockClear());

  t('files urgent, escalated reports once, and working one sends no notice to the stand-in reporter', async () => {
    const { Report } = require('../../../models');
    const { fileUnderageReports } = require('../../../utils/underageFlag');
    const admin = (await makeMember({ user: { role: 'admin' } })).user;
    const kid = (await makeMember()).user;
    ids.push(admin.id, kid.id);
    const under = [{ p: { userId: kid.id, gender: 'male' }, age: 17, min: 21 }];

    expect(await fileUnderageReports({ reporter: admin, under, Report })).toBe(1);
    expect(await fileUnderageReports({ reporter: admin, under, Report })).toBe(0);
    const row = await Report.findOne({ where: { reportedUserId: kid.id } });
    expect(row).toMatchObject({ priority: 'urgent', reason: 'underage', status: 'pending' });
    expect(row.escalatedAt).not.toBeNull();

    const res = await call(require('../../../controllers/adminController').updateReport, { user: admin, params: { reportId: row.id }, body: { status: 'resolved', adminNotes: 'checked' } });
    expect(res.statusCode).toBe(200);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  t('an ordinary member-filed report still notifies its reporter', async () => {
    const { Report } = require('../../../models');
    const admin = (await makeMember({ user: { role: 'admin' } })).user;
    const a = (await makeMember()).user; const b = (await makeMember()).user;
    ids.push(admin.id, a.id, b.id);
    const row = await Report.create({ reporterId: a.id, reportedUserId: b.id, reason: 'spam', description: 'spammy' });
    await call(require('../../../controllers/adminController').updateReport, { user: admin, params: { reportId: row.id }, body: { status: 'dismissed' } });
    expect(mockNotify).toHaveBeenCalledWith(a.id, 'report_reviewed', expect.any(String), expect.any(String));
  });
});
