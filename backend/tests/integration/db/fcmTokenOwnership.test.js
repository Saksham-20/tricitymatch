/** MATCH-18: a device token moves to the account that registered it last. */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('FCM token ownership', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  const member = async () => { const m = await makeMember(); ids.push(m.user.id); return m.user; };
  const register = (u, token) => call(require('../../../controllers/notificationController').registerFcmToken, { user: u, body: { token } });
  const tokensOf = async (u) => (await require('../../../models').User.findByPk(u.id, { attributes: ['fcmTokens'] })).fcmTokens;

  t('registering a token on B removes it from A, and keeps A\'s other devices', async () => {
    const a = await member(); const b = await member();
    const shared = `tok-shared-${Date.now()}-abcdefghij`;
    const other = `tok-other-${Date.now()}-abcdefghij`;
    await register(a, shared); await register(a, other);
    expect(await tokensOf(a)).toEqual(expect.arrayContaining([shared, other]));

    const res = await register(b, shared);
    expect(res.statusCode).toBe(200);
    expect(await tokensOf(b)).toContain(shared);
    const after = await tokensOf(a);
    expect(after).not.toContain(shared);
    expect(after).toContain(other);
  });

  t('re-registering the same token on the same account is idempotent', async () => {
    const a = await member();
    const tok = `tok-same-${Date.now()}-abcdefghij`;
    await register(a, tok); await register(a, tok);
    expect((await tokensOf(a)).filter((x) => x === tok)).toHaveLength(1);
  });
});
