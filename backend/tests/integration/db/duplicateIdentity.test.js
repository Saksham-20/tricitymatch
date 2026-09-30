/**
 * Duplicate-person signal on the suspicious-accounts queue (audit P2).
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('duplicate identity detection', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  t('flags accounts sharing name, birth date and gender, ignoring case and spacing', async () => {
    const { getSuspicious } = require('../../../controllers/adminSafetyController');
    const staff = (await makeMember({ user: { role: 'admin' } })).user;
    const twin = { firstName: 'Zzdup', lastName: `Person${Date.now()}`, dateOfBirth: '1990-02-03', gender: 'male' };
    const a = await makeMember({ profile: twin });
    const b = await makeMember({ profile: { ...twin, firstName: ' zzdup ', lastName: twin.lastName.toUpperCase() } });
    const other = await makeMember({ profile: { ...twin, dateOfBirth: '1991-02-03' } });
    ids.push(staff.id, a.user.id, b.user.id, other.user.id);

    const res = await call(getSuspicious, { user: staff, query: { includeTest: 'true' } });
    expect(res.statusCode).toBe(200);
    const byId = Object.fromEntries(res.body.accounts.map((x) => [x.id, x]));
    expect(byId[a.user.id].signals.map((s) => s.key)).toContain('duplicateIdentity');
    expect(byId[b.user.id].signals.map((s) => s.key)).toContain('duplicateIdentity');
    // different birth date: not the same person
    expect(byId[other.user.id]).toBeUndefined();
  });
});
