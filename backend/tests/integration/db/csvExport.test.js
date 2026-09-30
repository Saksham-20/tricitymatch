/**
 * The members CSV neutralises spreadsheet formulas in member-controlled fields
 * (audit P2: CSV formula-injection guard).
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('members CSV export', (t) => {
  const ids = [];
  afterAll(async () => { await removeMembers(ids); });

  t('a city or name that starts like a formula is exported as text', async () => {
    const m = await makeMember({ profile: { city: '=HYPERLINK("http://evil.example","x")', firstName: '@SUM', lastName: 'Row' } });
    ids.push(m.user.id);
    const { exportUsers } = require('../../../controllers/adminController');
    const res = await call(exportUsers, { user: { id: m.user.id, role: 'admin' }, query: { search: m.user.email } });
    expect(res.statusCode).toBe(200);
    const csv = res.body;
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(csv).toContain("'@SUM Row");
  });
});
