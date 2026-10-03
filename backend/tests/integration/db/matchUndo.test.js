/**
 * 'undo': the member takes back their OWN row (un-save, withdraw an interest).
 * Before this existed the server had no way to remove a shortlist or a like, so
 * the web showed "Removed from shortlist" while the row stayed.
 */
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/emailService', () => ({ sendMatchNotification: jest.fn(async () => true) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('matchAction undo', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  const pair = async () => {
    const a = await makeMember({ profile: { gender: 'male' } });
    const b = await makeMember({ profile: { gender: 'female' } });
    ids.push(a.user.id, b.user.id);
    return [a.user, b.user];
  };
  const act = (user, other, body) => call(require('../../../controllers/matchController').matchAction, { user, params: { userId: other.id }, body });
  const rowOf = (u, o) => require('../../../models').Match.findOne({ where: { userId: u.id, matchedUserId: o.id } });

  t('un-saving a shortlisted profile removes the row', async () => {
    const [a, b] = await pair();
    expect((await act(a, b, { action: 'shortlist' })).statusCode).toBe(200);
    expect((await rowOf(a, b)).action).toBe('shortlist');
    const res = await act(a, b, { action: 'undo' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ removed: true, isMutual: false, withdrawn: false });
    expect(await rowOf(a, b)).toBeNull();
  });

  t('withdrawing a one-way like removes it, and a second undo is a harmless no-op', async () => {
    const [a, b] = await pair();
    await act(a, b, { action: 'like' });
    expect((await act(a, b, { action: 'undo' })).body.removed).toBe(true);
    expect(await rowOf(a, b)).toBeNull();
    const again = await act(a, b, { action: 'undo' });
    expect(again.statusCode).toBe(200);
    expect(again.body.removed).toBe(false);
  });

  t('undo on a mutual match ends it for both sides but keeps the other member\'s like', async () => {
    const [a, b] = await pair();
    await act(a, b, { action: 'like' });
    const matched = await act(b, a, { action: 'like' });
    expect(matched.body.newMatch).toBe(true);
    const res = await act(a, b, { action: 'undo' });
    expect(res.body).toMatchObject({ removed: true, withdrawn: true, isMutual: false });
    expect(await rowOf(a, b)).toBeNull();
    const theirs = await rowOf(b, a);
    expect(theirs.action).toBe('like');
    expect(theirs.isMutual).toBe(false);
  });

  t('undo still works after the other member hides their profile (no trap)', async () => {
    const { Profile } = require('../../../models');
    const [a, b] = await pair();
    await act(a, b, { action: 'shortlist' });
    await Profile.update({ isActive: false }, { where: { userId: b.id } });
    // any other action is now refused...
    expect((await act(a, b, { action: 'like' })).statusCode).toBe(404);
    // ...but taking your own row back is not.
    const res = await act(a, b, { action: 'undo' });
    expect(res.statusCode).toBe(200);
    expect(await rowOf(a, b)).toBeNull();
  });

  t('undo on yourself is refused', async () => {
    const [a] = await pair();
    expect((await act(a, a, { action: 'undo' })).statusCode).toBe(400);
  });
});
