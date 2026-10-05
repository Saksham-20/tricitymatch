/**
 * The members CSV: neutralises spreadsheet formulas in member-controlled fields
 * (audit P2), and is streamed in batches with NO row cap. It used to stop at
 * 5,000 rows without saying so.
 */

jest.mock('../../../middlewares/logger', () => {
  const actual = jest.requireActual('../../../middlewares/logger');
  return { ...actual, logAudit: jest.fn() };
});

const { describeDb, makeMember, removeMembers, callStream, uniq } = require('../../helpers/db');

describeDb('members CSV export', (t) => {
  const ids = [];
  let ctl; let audit;
  beforeAll(() => { ctl = require('../../../controllers/adminController'); audit = require('../../../middlewares/logger').logAudit; });
  afterEach(() => { ctl.__exportBatchForTests = undefined; });
  afterAll(async () => { await removeMembers(ids); });

  const admin = { id: '00000000-0000-4000-8000-000000000001', role: 'admin' };
  const lines = (csv) => csv.replace(/^\uFEFF/, '').split('\n').filter(Boolean);

  t('a city or name that starts like a formula is exported as text', async () => {
    const m = await makeMember({ profile: { city: '=HYPERLINK("http://evil.example","x")', firstName: '@SUM', lastName: 'Row' } });
    ids.push(m.user.id);
    const res = await callStream(ctl.exportUsers, { user: admin, query: { search: m.user.email } });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(res.body).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(res.body).toContain("'@SUM Row");
  });

  t('exports every matching member across batches, with a row count the client can check', async () => {
    const tag = uniq();
    const made = [];
    for (let i = 0; i < 7; i += 1) {
      const m = await makeMember({ user: { email: `exp-${tag}-${i}@example.test` } });
      ids.push(m.user.id); made.push(m.user.id);
    }
    ctl.__exportBatchForTests = 3; // 7 rows => batches of 3, 3, 1

    const res = await callStream(ctl.exportUsers, { user: admin, query: { search: `exp-${tag}` } });
    const rows = lines(res.body);
    expect(rows).toHaveLength(1 + 7);                       // header + every member
    expect(res.headers['x-total-rows']).toBe('7');
    for (const id of made) expect(res.body).toContain(id); // none dropped at a batch boundary
    // No member repeated across batches.
    const idCol = rows[0].split(',').indexOf('Member ID');
    expect(new Set(rows.slice(1).map((r) => r.split(',')[idCol])).size).toBe(7);
    expect(res.headers['content-disposition']).toMatch(/tricitymatch-members-\d{4}-\d{2}-\d{2}\.csv/);
  });

  t('carries the new columns after the original ones and a usable profile code', async () => {
    const m = await makeMember({ user: { emailVerified: true } });
    ids.push(m.user.id);
    const res = await callStream(ctl.exportUsers, { user: admin, query: { search: m.user.email } });
    const [header, row] = lines(res.body);
    expect(header.split(',').slice(0, 10).join(',')).toBe('Name,Email,Phone,City,Gender,Role,Status,Plan,Has photo,Joined');
    expect(header).toMatch(/Last active,Email verified,Phone verified,Profile code,Member ID,Hidden from members$/);
    expect(row).toContain(`TCS-${m.user.id.split('-')[0].toUpperCase()}`);
    expect(row).toContain(',yes,no,'); // email verified, phone not
  });

  t('records how many rows went out and whether the file was complete', async () => {
    const m = await makeMember();
    ids.push(m.user.id);
    audit.mockClear();
    await callStream(ctl.exportUsers, { user: admin, query: { search: m.user.email } });
    const [, , meta] = audit.mock.calls.find((c) => c[0] === 'users_exported');
    expect(meta).toMatchObject({ rows: 1, expected: 1, complete: true });
    // The search text itself (an email) is never written to the audit row.
    expect(JSON.stringify(meta)).not.toContain(m.user.email);
    expect(meta.filters).toEqual(['search']);
  });
});
