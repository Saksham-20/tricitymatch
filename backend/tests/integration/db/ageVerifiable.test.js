/**
 * SAFE-18: a profile with no date of birth / gender (a mobile sign-up part-way
 * through onboarding) is not listed, viewable, or able to send interests,
 * messages or calls. Members who have both fields are unaffected, whether or
 * not the onboardingComplete flag has been set on their row.
 */
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/emailService', () => ({ sendMatchNotification: jest.fn(async () => true), sendMessageNotification: jest.fn(async () => true) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('age-verifiable gate', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  const member = async (o = {}) => { const m = await makeMember(o); ids.push(m.user.id); return m.user; };
  const incomplete = (extra = {}) => member({ profile: { dateOfBirth: null, gender: null, onboardingComplete: false, ...extra } });
  const act = (user, other, action = 'like') => call(require('../../../controllers/matchController').matchAction, { user, params: { userId: other.id }, body: { action } });

  t('listing scope leaves out incomplete profiles and keeps onboarded and flag-less complete ones', async () => {
    const { Profile } = require('../../../models');
    const { loadViewerContext, listingScope } = require('../../../utils/profileVisibility');
    const viewer = await member();
    const onboarded = await member({ profile: { onboardingComplete: true } });
    const flagless = await member(); // DOB + gender, onboardingComplete default false
    const noDob = await incomplete({ gender: 'male' });
    const noGender = await incomplete({ dateOfBirth: '1995-01-01' });
    const nothing = await incomplete();
    const wanted = [onboarded, flagless, noDob, noGender, nothing].map((u) => u.id);

    const ctx = await loadViewerContext(viewer.id);
    const rows = await Profile.findAll({ where: { ...listingScope(ctx), userId: { [require('sequelize').Op.in]: wanted } }, attributes: ['userId'] });
    expect(rows.map((r) => r.userId).sort()).toEqual([onboarded.id, flagless.id].sort());
  });

  t('opening an incomplete profile is a 404; opening your own is fine; a complete one is fine', async () => {
    const getProfile = require('../../../controllers/profileController').getProfile;
    const viewer = await member();
    const ghost = await incomplete({ gender: 'female' });
    const full = await member();
    expect((await call(getProfile, { user: viewer, params: { userId: ghost.id } })).statusCode).toBe(404);
    expect((await call(getProfile, { user: viewer, params: { userId: full.id } })).statusCode).toBe(200);
    expect((await call(getProfile, { user: ghost, params: { userId: ghost.id } })).statusCode).toBe(200);
  });

  t('interests: refused toward an incomplete profile (404) and from one (403), allowed between complete members', async () => {
    const { Match } = require('../../../models');
    const a = await member({ profile: { gender: 'male' } });
    const b = await member({ profile: { gender: 'female' } });
    const ghost = await incomplete();

    const toGhost = await act(a, ghost);
    expect(toGhost.statusCode).toBe(404);
    expect(await Match.count({ where: { userId: a.id, matchedUserId: ghost.id } })).toBe(0);

    const fromGhost = await act(ghost, b);
    expect(fromGhost.statusCode).toBe(403);
    expect(fromGhost.body.error.code).toBe('PROFILE_INCOMPLETE');
    expect(await Match.count({ where: { userId: ghost.id } })).toBe(0);

    const ok = await act(a, b);
    expect(ok.statusCode).toBe(200);
  });

  t('an incomplete member cannot message or call even through an old mutual match', async () => {
    const { Match } = require('../../../models');
    const ghost = await incomplete();
    const other = await member();
    await Match.create({ userId: ghost.id, matchedUserId: other.id, action: 'like', isMutual: true });
    await Match.create({ userId: other.id, matchedUserId: ghost.id, action: 'like', isMutual: true });

    const chat = require('../../../controllers/chatController');
    const msg = await call(chat.sendMessage, { user: ghost, body: { receiverId: other.id, content: 'hello' } });
    expect(msg.statusCode).toBe(403);
    const ring = await call(require('../../../controllers/callController').initiateCall, { user: ghost, body: { calleeId: other.id } });
    expect(ring.statusCode).toBe(403);
  });
});
