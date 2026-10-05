/**
 * Admin "quiet hide": an admin can make a member invisible to other members
 * without banning them. Left out of search, daily matches, profile-code lookups
 * and the community count; still able to sign in; still visible to anyone they
 * contact; never told (the state never rides the member's own payloads).
 */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('admin: invisible members', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  const tag = () => `Vis${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const mk = async (opts) => { const m = await makeMember(opts); ids.push(m.user.id); return m; };
  const admin = () => require('../../../controllers/adminController');
  const setVisible = (staff, userId, body) => call(admin().updateUserVisibility, { user: staff, params: { userId }, body });
  const search = async (viewer, city) => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const res = await call(searchProfiles, { user: viewer.user, query: { city, limit: '50' } });
    expect(res.statusCode).toBe(200);
    return res.body.profiles.map((p) => p.userId);
  };

  t('hiding takes a member out of search and profile-code lookup; showing puts them back', async () => {
    const { getProfileByCode } = require('../../../controllers/searchController');
    const { toProfileCode } = require('../../../utils/profileCode');
    const city = tag();
    const staff = (await mk({ user: { role: 'admin' } })).user;
    const viewer = await mk({ profile: { gender: 'male' } });
    const target = await mk({ profile: { gender: 'female', city } });
    expect(await search(viewer, city)).toContain(target.user.id);

    const hid = await setVisible(staff, target.user.id, { hidden: true, reason: 'test account' });
    expect(hid.statusCode).toBe(200);
    expect(hid.body.invisible).toMatchObject({ reason: 'test account' });

    expect(await search(viewer, city)).not.toContain(target.user.id);
    const byCode = await call(getProfileByCode, { user: viewer.user, query: { code: toProfileCode(target.user.id) } });
    expect(byCode.statusCode).toBe(404);

    expect((await setVisible(staff, target.user.id, { hidden: false })).statusCode).toBe(200);
    expect(await search(viewer, city)).toContain(target.user.id);
  });

  t('quiet: the member can still be opened by someone they contacted, and their own payload says nothing', async () => {
    const { getProfile } = require('../../../controllers/profileController');
    const { User } = require('../../../models');
    const staff = (await mk({ user: { role: 'admin' } })).user;
    const viewer = await mk({ profile: { gender: 'male' } });
    const target = await mk({ profile: { gender: 'female' } });
    await setVisible(staff, target.user.id, { hidden: true, reason: 'details being checked' });

    const opened = await call(getProfile, { user: viewer.user, params: { userId: target.user.id } });
    expect(opened.statusCode).toBe(200);

    const own = (await User.findByPk(target.user.id)).toJSON();
    expect(own).not.toHaveProperty('hiddenAt');
    expect(own).not.toHaveProperty('hiddenReason');
    expect(own).not.toHaveProperty('hiddenBy');
  });

  t('a reason is required, staff cannot be targeted, and the change is audited', async () => {
    const { AuditLog } = require('../../../models');
    const staff = (await mk({ user: { role: 'admin' } })).user;
    const otherStaff = (await mk({ user: { role: 'marketing' } })).user;
    const target = await mk({ profile: { gender: 'female' } });

    expect((await setVisible(staff, target.user.id, { hidden: true, reason: '' })).statusCode).toBe(400);
    expect((await setVisible(staff, target.user.id, { hidden: 'yes', reason: 'x y z' })).statusCode).toBe(400);
    expect((await setVisible(staff, otherStaff.id, { hidden: true, reason: 'nope' })).statusCode).toBe(400);

    expect((await setVisible(staff, target.user.id, { hidden: true, reason: 'fake photos' })).statusCode).toBe(200);
    expect((await setVisible(staff, target.user.id, { hidden: false })).statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 100)); // audit rows are written off the request path
    const actions = (await AuditLog.findAll({ where: { targetUserId: target.user.id } })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['member_hidden', 'member_unhidden']));
  });

  t('the admin record and the member list show it, and the list can be filtered by it', async () => {
    const staff = (await mk({ user: { role: 'admin' } })).user;
    const target = await mk({ profile: { gender: 'female' } });
    await setVisible(staff, target.user.id, { hidden: true, reason: 'test account' });

    const record = await call(admin().getUser, { user: staff, params: { userId: target.user.id } });
    expect(record.statusCode).toBe(200);
    const body = JSON.parse(JSON.stringify(record.body));
    expect(body.user.invisible).toMatchObject({ reason: 'test account', byEmail: staff.email });
    expect(body.user).not.toHaveProperty('hiddenReason');

    const hidden = await call(admin().getUsers, { user: staff, query: { visibility: 'hidden', search: target.user.email, limit: '100' } });
    expect(JSON.parse(JSON.stringify(hidden.body)).users.map((u) => u.id)).toContain(target.user.id);
    const visible = await call(admin().getUsers, { user: staff, query: { visibility: 'visible', search: target.user.email, limit: '100' } });
    expect(JSON.parse(JSON.stringify(visible.body)).users.map((u) => u.id)).not.toContain(target.user.id);
  });
});
