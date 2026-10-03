/**
 * Blocking must not be a window onto members the blocker could not otherwise
 * see, and the blocked list must never carry an email address.
 */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('block privacy', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  const member = async (o = {}) => { const m = await makeMember(o); ids.push(m.user.id); return m.user; };
  const ctl = () => require('../../../controllers/blockReportController');
  const list = (u) => call(ctl().getBlockedUsers, { user: u });
  const block = (u, target) => call(ctl().blockUser, { user: u, params: { userId: target.id } });

  t('GET /block never returns an email address', async () => {
    const me = await member(); const them = await member();
    expect((await block(me, them)).statusCode).toBe(201);
    const res = await list(me);
    expect(res.statusCode).toBe(200);
    const row = res.body.blocks.find((b) => b.blockedUserId === them.id);
    expect(row).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain('@example.test');
    expect(row.BlockedUser.email).toBeUndefined();
    expect(row.BlockedUser.Profile.firstName).toBeDefined();
  });

  t('a member who matches_only-hides cannot be probed by a stranger via block', async () => {
    const me = await member();
    const hidden = await member({ profile: { profileVisibility: 'matches_only' } });
    const res = await block(me, hidden);
    expect(res.statusCode).toBe(404);
    const after = await list(me);
    expect(after.body.blocks.find((b) => b.blockedUserId === hidden.id)).toBeUndefined();
  });

  t('a paused (inactive) profile is refused the same way, and an unknown id looks identical', async () => {
    const me = await member();
    const paused = await member({ profile: { isActive: false } });
    const a = await block(me, paused);
    const b = await block(me, { id: '00000000-0000-4000-8000-000000000000' });
    expect(a.statusCode).toBe(404);
    expect(b.statusCode).toBe(404);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  t('someone who already reached the blocker CAN be blocked even after hiding', async () => {
    const { Message } = require('../../../models');
    const me = await member();
    const stalker = await member({ profile: { profileVisibility: 'matches_only' } });
    await Message.create({ senderId: stalker.id, receiverId: me.id, content: 'hello' });
    const res = await block(me, stalker);
    expect(res.statusCode).toBe(201);
  });

  t('staff accounts are not blockable targets for a stranger', async () => {
    const me = await member();
    const staff = await member({ user: { role: 'admin' } });
    expect((await block(me, staff)).statusCode).toBe(404);
  });

  t('re-blocking an existing block still succeeds (repair path)', async () => {
    const me = await member(); const them = await member();
    expect((await block(me, them)).statusCode).toBe(201);
    await require('../../../models').Profile.update({ isActive: false }, { where: { userId: them.id } });
    expect((await block(me, them)).statusCode).toBe(200);
  });
});
