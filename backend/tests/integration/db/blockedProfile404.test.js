/**
 * A blocked member opening the blocker's profile gets exactly what an unknown
 * profile gets: 404 "Profile not found". It used to be a 403, which told them
 * they had been blocked, against the block dialog's promise that the other
 * person is not told. The same holds the other way round, and for the
 * compatibility read that shares the gate.
 */
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('../../../utils/smsService', () => ({ sendOtp: jest.fn(), verifyOtp: jest.fn() }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describeDb('blocked profile reads as not found', (t) => {
  const ids = [];
  let models;
  beforeAll(() => { models = require('../../../models'); });
  afterAll(() => removeMembers(ids));

  const member = async () => { const m = await makeMember(); ids.push(m.user.id); return m.user; };
  const ctl = () => require('../../../controllers/profileController');
  const view = (viewer, targetId) => call(ctl().getProfile, { user: { id: viewer.id, role: 'user' }, params: { userId: targetId } });
  const compat = (viewer, targetId) => call(ctl().getCompatibilityBreakdown, { user: { id: viewer.id, role: 'user' }, params: { userId: targetId } });
  // What the error handler serialises: status, message and code.
  const shape = (res) => ({ status: res.statusCode, message: res.body?.error?.message, code: res.body?.error?.code });

  t('the blocked member gets the same 404 as for an unknown id', async () => {
    const blocker = await member();
    const blocked = await member();
    await models.Block.create({ blockerId: blocker.id, blockedUserId: blocked.id });

    const res = await view(blocked, blocker.id);
    const unknown = await view(blocked, UNKNOWN_ID);
    expect(res.statusCode).toBe(404);
    expect(shape(res)).toEqual(shape(unknown));
  });

  t('the blocker gets the same 404 too (the block is not revealed either way)', async () => {
    const blocker = await member();
    const blocked = await member();
    await models.Block.create({ blockerId: blocker.id, blockedUserId: blocked.id });

    const res = await view(blocker, blocked.id);
    expect(shape(res)).toEqual(shape(await view(blocker, UNKNOWN_ID)));
  });

  t('compatibility, which shares the gate, answers the same way', async () => {
    const blocker = await member();
    const blocked = await member();
    await models.Block.create({ blockerId: blocker.id, blockedUserId: blocked.id });

    const res = await compat(blocked, blocker.id);
    expect(res.statusCode).toBe(404);
    expect(shape(res)).toEqual(shape(await compat(blocked, UNKNOWN_ID)));
  });

  t('an interest to or from a blocked member answers like an unknown profile', async () => {
    const blocker = await member();
    const blocked = await member();
    await models.Block.create({ blockerId: blocker.id, blockedUserId: blocked.id });
    const match = require('../../../controllers/matchController');
    const act = (actor, targetId) => call(match.matchAction, {
      user: { id: actor.id, role: 'user' }, params: { userId: targetId }, body: { action: 'like' },
    });

    const res = await act(blocked, blocker.id);
    expect(res.statusCode).toBe(404);
    expect(shape(res)).toEqual(shape(await act(blocked, UNKNOWN_ID)));
    expect(shape(await act(blocker, blocked.id))).toEqual(shape(await act(blocker, UNKNOWN_ID)));
    expect(await models.Match.count({ where: { userId: blocked.id } })).toBe(0);
  });

  t('without a block the profile opens', async () => {
    const a = await member();
    const b = await member();
    const res = await view(a, b.id);
    expect(res.statusCode).toBe(200);
    expect(res.body.profile.userId).toBe(b.id);
  });
});
