/** SAFE-13: appeals and overturns are for ordinary members only. */
jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('appeals and staff accounts', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "Appeals" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });
  const mk = async (u) => { const m = await makeMember({ user: u }); ids.push(m.user.id); return m.user; };
  const ctl = () => require('../../../controllers/appealController');
  const statement = 'I believe this suspension was a mistake, please review it.';

  t('a banned admin or marketing account cannot file an appeal (same generic answer)', async () => {
    const { Appeal } = require('../../../models');
    const staff = await mk({ role: 'admin', status: 'banned' });
    const rep = await mk({ role: 'marketing', status: 'inactive' });
    for (const u of [staff, rep]) {
      const res = await call(ctl().submitAppeal, { body: { email: u.email, statement } });
      expect(res.statusCode).toBe(202);
      expect(await Appeal.count({ where: { userId: u.id } })).toBe(0);
    }
  });

  t('a banned ordinary member can appeal and be restored', async () => {
    const { Appeal, User } = require('../../../models');
    const staff = await mk({ role: 'admin' });
    const member = await mk({ status: 'banned' });
    await call(ctl().submitAppeal, { body: { email: member.email, statement } });
    const appeal = await Appeal.findOne({ where: { userId: member.id } });
    expect(appeal).not.toBeNull();
    const res = await call(ctl().decideAppeal, { user: staff, params: { id: appeal.id }, body: { decision: 'overturned', note: 'Reviewed and restored.' } });
    expect(res.statusCode).toBe(200);
    expect((await User.findByPk(member.id)).status).toBe('active');
  });

  t('overturning an appeal that belongs to a staff account is refused and changes nothing', async () => {
    const { Appeal, User } = require('../../../models');
    const staff = await mk({ role: 'admin' });
    const target = await mk({ role: 'admin', status: 'banned' });
    const appeal = await Appeal.create({ userId: target.id, email: target.email, statement });
    const res = await call(ctl().decideAppeal, { user: staff, params: { id: appeal.id }, body: { decision: 'overturned', note: 'Restoring this one.' } });
    expect(res.statusCode).toBe(403);
    expect((await User.findByPk(target.id)).status).toBe('banned');
    expect((await Appeal.findByPk(appeal.id)).status).toBe('pending');
  });

  // Regression: listAppeals eager-loads the appellant via `include: [{ model: User }]`.
  // The Appeal->User association was never declared, so the admin Appeals list 500'd
  // with "User is not associated to Appeal!" (shipped broken to prod 2026-09-30).
  t('listing appeals eager-loads the appellant (association regression)', async () => {
    const { Appeal } = require('../../../models');
    const member = await mk({ status: 'banned' });
    await Appeal.create({ userId: member.id, email: member.email, statement });
    const res = await call(ctl().listAppeals, { query: { status: 'pending' } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.appeals)).toBe(true);
    const row = res.body.appeals.find((a) => a.userId === member.id);
    expect(row).toBeTruthy();
    expect(row.User).toBeTruthy();
    expect(row.User.email).toBe(member.email);
  });
});
