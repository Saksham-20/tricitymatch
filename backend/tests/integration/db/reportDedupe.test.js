/**
 * One open report per reporter and target; urgent staff mail at most once per
 * reported member per hour.
 */
jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('report dedupe', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "Reports" WHERE "reporterId" IN (:ids) OR "reportedUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });
  beforeEach(() => jest.clearAllMocks());
  const member = async () => { const m = await makeMember(); ids.push(m.user.id); return m.user; };
  const report = (from, to, body) => call(require('../../../controllers/blockReportController').reportUser, { user: from, params: { userId: to.id }, body });
  const count = (from, to) => require('../../../models').Report.count({ where: { reporterId: from.id, reportedUserId: to.id } });
  const flush = () => new Promise((r) => setTimeout(r, 80));

  t('the same report filed twice is one report, and the second returns the first id', async () => {
    const a = await member(); const b = await member();
    const r1 = await report(a, b, { reason: 'spam', description: 'first note' });
    expect(r1.statusCode).toBe(201);
    const r2 = await report(a, b, { reason: 'spam', description: 'second note' });
    expect(r2.statusCode).toBe(200);
    expect(r2.body).toMatchObject({ duplicate: true, reportId: r1.body.reportId });
    expect(await count(a, b)).toBe(1);
    const row = await require('../../../models').Report.findByPk(r1.body.reportId);
    expect(row.description).toContain('first note');
    expect(row.description).toContain('second note');
  });

  t('a flood of identical reports leaves one row and sends at most one urgent mail', async () => {
    const { sendEmail } = require('../../../utils/email');
    const a = await member(); const b = await member();
    for (let i = 0; i < 6; i += 1) await report(a, b, { reason: 'threats' });
    await flush();
    expect(await count(a, b)).toBe(1);
    expect(sendEmail.mock.calls.length).toBeLessThanOrEqual(1);
  });

  t('two different reporters against one member: both reports kept, one urgent mail per hour', async () => {
    const { sendEmail } = require('../../../utils/email');
    const a = await member(); const c = await member(); const b = await member();
    expect((await report(a, b, { reason: 'threats' })).statusCode).toBe(201);
    expect((await report(c, b, { reason: 'threats' })).statusCode).toBe(201);
    await flush();
    expect(await count(a, b)).toBe(1);
    expect(await count(c, b)).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  t('an urgent reason on an open non-urgent report is a real escalation', async () => {
    const a = await member(); const b = await member();
    const first = await report(a, b, { reason: 'spam' });
    expect(first.statusCode).toBe(201);
    const second = await report(a, b, { reason: 'threats' });
    expect(second.statusCode).toBe(201);
    expect(second.body.reportId).not.toBe(first.body.reportId);
    expect(await count(a, b)).toBe(2);
  });

  t('once a report is resolved the reporter can file a new one', async () => {
    const { Report } = require('../../../models');
    const a = await member(); const b = await member();
    const first = await report(a, b, { reason: 'spam' });
    await Report.update({ status: 'resolved' }, { where: { id: first.body.reportId } });
    const again = await report(a, b, { reason: 'spam' });
    expect(again.statusCode).toBe(201);
  });
});
