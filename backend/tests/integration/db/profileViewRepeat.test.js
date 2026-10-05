/** PROF-17: a repeat visit refreshes the stored view instead of being dropped. */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('profile views: repeat visits', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  t('second visit moves createdAt forward, keeps one row, incognito records nothing', async () => {
    const { getProfile } = require('../../../controllers/profileController');
    const { ProfileView, Profile } = require('../../../models');
    const owner = await makeMember({ profile: { gender: 'male' } });
    const viewer = await makeMember();
    const sneaky = await makeMember({ profile: { incognitoMode: true } });
    ids.push(owner.user.id, viewer.user.id, sneaky.user.id);

    await call(getProfile, { user: viewer.user, params: { userId: owner.user.id } });
    const first = await ProfileView.findOne({ where: { viewerId: viewer.user.id, viewedUserId: owner.user.id } });
    expect(first).not.toBeNull();
    // pretend the first visit was 3 days ago
    const old = new Date(Date.now() - 3 * 86400000);
    await ProfileView.update({ createdAt: old }, { where: { id: first.id }, silent: true });

    await call(getProfile, { user: viewer.user, params: { userId: owner.user.id } });
    const rows = await ProfileView.findAll({ where: { viewerId: viewer.user.id, viewedUserId: owner.user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].createdAt.getTime()).toBeGreaterThan(old.getTime() + 86400000);

    await call(getProfile, { user: sneaky.user, params: { userId: owner.user.id } });
    expect(await ProfileView.count({ where: { viewerId: sneaky.user.id } })).toBe(0);
    expect(Profile).toBeDefined();
  });

  t('staff browsing a profile leave no view, and cannot send an interest', async () => {
    const { getProfile } = require('../../../controllers/profileController');
    const { matchAction } = require('../../../controllers/matchController');
    const { ProfileView, Match } = require('../../../models');
    const owner = await makeMember({ profile: { gender: 'male' } });
    const partner = await makeMember({ user: { role: 'marketing' } });
    const admin = await makeMember({ user: { role: 'admin' } });
    ids.push(owner.user.id, partner.user.id, admin.user.id);

    for (const staff of [partner, admin]) {
      const seen = await call(getProfile, { user: staff.user, params: { userId: owner.user.id } });
      expect(seen.statusCode).toBe(200);
      expect(await ProfileView.count({ where: { viewerId: staff.user.id } })).toBe(0);
      const liked = await call(matchAction, { user: staff.user, params: { userId: owner.user.id }, body: { action: 'like' } });
      expect(liked.statusCode).toBe(403);
      expect(await Match.count({ where: { userId: staff.user.id } })).toBe(0);
    }
  });
});

