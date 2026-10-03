/** SAFE-04: report queue ordering, search, pagination and assignee. */
jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ success: true }) }));
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('admin report queue', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "Reports" WHERE "reportedUserId" IN (:ids) OR "reporterId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });
  const mk = async (o) => { const m = await makeMember(o); ids.push(m.user.id); return m.user; };
  const list = (query) => call(require('../../../controllers/adminController').getReports, { user: { id: 'x', role: 'admin' }, query });

  t('open reports are urgent-first then oldest-first; search and pagination work; assignee included', async () => {
    const { Report } = require('../../../models');
    const staff = await mk({ user: { role: 'admin' } });
    const subject = await mk({ profile: { firstName: 'Zebulonq' } });
    const reporter = await mk();
    const mkReport = (extra) => Report.create({ reporterId: reporter.id, reportedUserId: subject.id, reason: 'spam', ...extra });
    const old = await mkReport({ createdAt: new Date(Date.now() - 3 * 86400000) });
    const mid = await mkReport({ createdAt: new Date(Date.now() - 1 * 86400000) });
    const urgent = await mkReport({ priority: 'urgent', reason: 'underage', createdAt: new Date() });
    await mid.update({ assignedTo: staff.id });

    const res = await list({ status: 'pending', search: 'Zebulonq', limit: '2' });
    expect(res.statusCode).toBe(200);
    expect(res.body.reports.map((r) => r.id)).toEqual([urgent.id, old.id]);
    expect(res.body.pagination).toMatchObject({ total: 3, pages: 2, limit: 2 });

    const p2 = await list({ status: 'pending', search: 'Zebulonq', limit: '2', page: '2' });
    expect(p2.body.reports.map((r) => r.id)).toEqual([mid.id]);
    expect(p2.body.reports[0].Assignee.id).toBe(staff.id);

    const none = await list({ status: 'pending', search: 'no-such-person-xyz' });
    expect(none.body.reports).toEqual([]);
    const urgentOnly = await list({ status: 'pending', search: 'Zebulonq', priority: 'urgent' });
    expect(urgentOnly.body.reports.map((r) => r.id)).toEqual([urgent.id]);
  });
});
