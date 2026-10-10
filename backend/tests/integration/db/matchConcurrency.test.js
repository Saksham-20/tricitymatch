/**
 * Interest state machine against a real Postgres (audit P1-9 / P1-13).
 *
 * The unit test proves the lock is requested; only a real database proves that
 * two members liking each other in the same instant still produce exactly one
 * mutual match and exactly one announcement.
 */

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/emailService', () => ({
  sendMatchNotification: jest.fn(async () => true),
}));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('matchAction on a real database', (t) => {
  const ids = [];
  afterAll(async () => { await removeMembers(ids); });

  const pair = async () => {
    const a = await makeMember({ profile: { gender: 'male' } });
    const b = await makeMember({ profile: { gender: 'female' } });
    ids.push(a.user.id, b.user.id);
    return [a.user, b.user];
  };

  t('simultaneous likes end mutual, once, with a single announcement', async (sequelize) => {
    const { matchAction } = require('../../../controllers/matchController');
    const { Match } = require('../../../models');
    const [a, b] = await pair();

    const [ra, rb] = await Promise.all([
      call(matchAction, { user: a, params: { userId: b.id }, body: { action: 'like' } }),
      call(matchAction, { user: b, params: { userId: a.id }, body: { action: 'like' } }),
    ]);

    expect([ra.statusCode, rb.statusCode]).toEqual([200, 200]);
    const rows = await Match.findAll({
      where: { userId: [a.id, b.id], matchedUserId: [a.id, b.id] },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.isMutual)).toBe(true);
    // Exactly one of the two responses reports the newly-formed match.
    const announced = [ra, rb].filter((r) => r.body && r.body.newMatch === true);
    expect(announced).toHaveLength(1);
    await sequelize.query('SELECT 1');
  });

  t('liking twice announces nothing the second time', async () => {
    const { matchAction } = require('../../../controllers/matchController');
    const [a, b] = await pair();
    await call(matchAction, { user: b, params: { userId: a.id }, body: { action: 'like' } });
    const first = await call(matchAction, { user: a, params: { userId: b.id }, body: { action: 'like' } });
    const again = await call(matchAction, { user: a, params: { userId: b.id }, body: { action: 'like' } });
    expect(first.body.newMatch).toBe(true);
    expect(again.body.newMatch).toBe(false);
  });

  t('passing on a mutual match withdraws it for both sides', async () => {
    const { matchAction } = require('../../../controllers/matchController');
    const { Match } = require('../../../models');
    const [a, b] = await pair();
    await call(matchAction, { user: b, params: { userId: a.id }, body: { action: 'like' } });
    await call(matchAction, { user: a, params: { userId: b.id }, body: { action: 'like' } });
    const out = await call(matchAction, { user: a, params: { userId: b.id }, body: { action: 'pass' } });
    expect(out.statusCode).toBe(200);
    const rows = await Match.findAll({ where: { userId: [a.id, b.id], matchedUserId: [a.id, b.id] } });
    expect(rows.some((r) => r.isMutual)).toBe(false);
  });

  t('a block in either direction refuses the action and writes nothing', async () => {
    const { matchAction } = require('../../../controllers/matchController');
    const { Block, Match } = require('../../../models');
    const [a, b] = await pair();
    await Block.create({ blockerId: b.id, blockedUserId: a.id });
    const out = await call(matchAction, { user: a, params: { userId: b.id }, body: { action: 'like' } });
    // Answered as "not found", so the blocked member is not told about the block.
    expect(out.statusCode).toBe(404);
    expect(await Match.count({ where: { userId: a.id, matchedUserId: b.id } })).toBe(0);
  });

  t('a member cannot act on themselves or on a banned account', async () => {
    const { matchAction } = require('../../../controllers/matchController');
    const [a, b] = await pair();
    const self = await call(matchAction, { user: a, params: { userId: a.id }, body: { action: 'like' } });
    expect(self.statusCode).toBe(400);
    await b.update({ status: 'banned' });
    const banned = await call(matchAction, { user: a, params: { userId: b.id }, body: { action: 'like' } });
    expect(banned.statusCode).toBe(404);
  });
});
