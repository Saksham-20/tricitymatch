/**
 * MATCH-16: engagement counters use the same scope as the lists beside them
 * (no blocked members, no inactive accounts), and a repeat visit moves the
 * row's timestamp forward.
 */
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('profile stats scope', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  const member = async (o = {}) => { const m = await makeMember(o); ids.push(m.user.id); return m.user; };

  t('views and likes from blocked or inactive members are not counted', async () => {
    const { ProfileView, Match, Block } = require('../../../models');
    const me = await member();
    const good = await member(); const blocked = await member(); const gone = await member({ user: { status: 'banned' } });
    for (const v of [good, blocked, gone]) {
      await ProfileView.create({ viewerId: v.id, viewedUserId: me.id });
      await Match.create({ userId: v.id, matchedUserId: me.id, action: 'like' });
    }
    await Block.create({ blockerId: me.id, blockedUserId: blocked.id });

    const res = await call(require('../../../controllers/profileController').getProfileStats, { user: me });
    expect(res.statusCode).toBe(200);
    expect(res.body.stats).toMatchObject({ viewsThisWeek: 1, totalViews: 1, likesReceived: 1 });
  });

  t('a repeat visit moves the existing view forward instead of being dropped', async () => {
    const { ProfileView } = require('../../../models');
    const sequelize = require('../../../config/database');
    const viewer = await member(); const target = await member();
    await ProfileView.create({ viewerId: viewer.id, viewedUserId: target.id });
    await sequelize.query('UPDATE "ProfileViews" SET "createdAt" = NOW() - interval \'30 days\' WHERE "viewerId" = :v', { replacements: { v: viewer.id } });

    // The profile read is the write path; a viewer opening the profile again.
    const res = await call(require('../../../controllers/profileController').getProfile, { user: viewer, params: { userId: target.id } });
    expect(res.statusCode).toBe(200);
    const row = await ProfileView.findOne({ where: { viewerId: viewer.id, viewedUserId: target.id } });
    expect(Date.now() - new Date(row.createdAt).getTime()).toBeLessThan(60000);
    expect(await ProfileView.count({ where: { viewerId: viewer.id, viewedUserId: target.id } })).toBe(1);
  });
});
