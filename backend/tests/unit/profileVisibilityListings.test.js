/**
 * One privacy rule for every profile listing (platform audit 2026-09-29, P0-5).
 *
 * Search and getProfile applied the privacy rules by hand; daily matches,
 * suggestions, by-code, likes, shortlist, sent and viewers applied a subset or
 * none. They returned photos a member had blurred until match, matches-only
 * and incognito members, banned accounts, intro-media URLs and internal keys
 * (quizAnswers, the member's private savedSearches). The daily set is cached
 * for a whole IST day, so a member who left visibility (or was erased) kept
 * appearing until midnight.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
  logAudit: jest.fn(),
}));

jest.mock('../../models', () => ({
  Block: { findOne: jest.fn(), findAll: jest.fn() },
  Match: { findOne: jest.fn(), findAll: jest.fn() },
  Profile: { findOne: jest.fn(), findAll: jest.fn() },
  User: { findByPk: jest.fn() },
  Subscription: { findOne: jest.fn(), findAll: jest.fn() },
  Verification: { findAll: jest.fn() },
}));

jest.mock('../../config/database', () => ({ transaction: jest.fn(), query: jest.fn() }));
jest.mock('../../utils/emailService', () => ({ sendMatchNotification: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/cache', () => ({ getOrSet: jest.fn() }));
jest.mock('../../utils/entitlements', () => ({ getActiveSubscription: jest.fn() }));

const { Op } = require('sequelize');
const models = require('../../models');
const sequelize = require('../../config/database');
const { getOrSet } = require('../../utils/cache');
const { getActiveSubscription } = require('../../utils/entitlements');
const {
  listingScope,
  redactForViewer,
  stripOwnerOnlyKeys,
  stillVisible,
} = require('../../utils/profileVisibility');
const match = require('../../controllers/matchController');

const ME = '11111111-1111-4111-8111-111111111111';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';

const run = async (handler, req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  let thrown = null;
  handler(req, res, (err) => { thrown = err; });
  await new Promise((resolve) => setImmediate(resolve));
  return { res, thrown };
};

const fullRow = () => ({
  userId: A,
  firstName: 'Asha',
  profilePhoto: 'https://cdn/x.jpg',
  photos: ['https://cdn/x.jpg', 'https://cdn/y.jpg'],
  voiceIntroUrl: 'https://cdn/v.mp3',
  videoIntroUrl: 'https://cdn/v.mp4',
  photoBlurUntilMatch: true,
  quizAnswers: [1, 2],
  incognitoMode: false,
  profileVisibility: 'everyone',
  showPhone: true,
  showEmail: true,
  showOnlineStatus: true,
  showLastSeen: true,
  socialMediaLinks: { instagram: { url: 'https://i/x', visibility: 'hidden' } },
  lifestylePreferences: { diet: 'veg', savedSearches: [{ name: 'my private filter' }] },
  User: { id: A },
});

beforeEach(() => {
  jest.clearAllMocks();
  models.Block.findAll.mockResolvedValue([]);
  models.Match.findAll.mockResolvedValue([]);
  models.Match.findOne.mockResolvedValue(null);
  getActiveSubscription.mockResolvedValue(null);
});

describe('redactForViewer', () => {
  it('withholds blurred photos from a non-mutual viewer', () => {
    const out = redactForViewer(fullRow(), { isMutual: false });
    expect(out.profilePhoto).toBeNull();
    expect(out.photos).toEqual([]);
  });

  it('shows the photos to a mutual match', () => {
    const out = redactForViewer(fullRow(), { isMutual: true });
    expect(out.profilePhoto).toBe('https://cdn/x.jpg');
    expect(out.photos).toHaveLength(2);
  });

  it('does not blur a photo the member never asked to blur', () => {
    const out = redactForViewer({ ...fullRow(), photoBlurUntilMatch: false }, { isMutual: false });
    expect(out.profilePhoto).toBe('https://cdn/x.jpg');
  });

  it('withholds intro-media URLs unless mutual or on a paid plan', () => {
    const free = redactForViewer(fullRow(), { isMutual: false, hasPaidAccess: false });
    expect(free.voiceIntroUrl).toBeNull();
    expect(free.videoIntroUrl).toBeNull();
    expect(redactForViewer(fullRow(), { isMutual: false, hasPaidAccess: true }).voiceIntroUrl).toBe('https://cdn/v.mp3');
    expect(redactForViewer(fullRow(), { isMutual: true, hasPaidAccess: false }).videoIntroUrl).toBe('https://cdn/v.mp4');
  });

  it('never carries owner-only keys or the private saved searches', () => {
    const out = redactForViewer(fullRow(), { isMutual: true, hasPaidAccess: true });
    for (const key of ['quizAnswers', 'incognitoMode', 'profileVisibility', 'showPhone', 'showEmail', 'showOnlineStatus', 'showLastSeen', 'photoBlurUntilMatch']) {
      expect(out).not.toHaveProperty(key);
    }
    // The rest of lifestylePreferences survives; only savedSearches goes.
    expect(out.lifestylePreferences).toEqual({ diet: 'veg' });
  });

  it('lists carry no social links and no nested User', () => {
    const out = redactForViewer(fullRow(), { isMutual: true, hasPaidAccess: true });
    expect(out).not.toHaveProperty('socialMediaLinks');
    expect(out).not.toHaveProperty('User');
  });

  it('leaves the owner\'s own profile untouched', () => {
    const out = redactForViewer(fullRow(), { isSelf: true });
    expect(out.quizAnswers).toEqual([1, 2]);
    expect(out.profilePhoto).toBe('https://cdn/x.jpg');
  });

  it('does not mutate its input', () => {
    const row = fullRow();
    redactForViewer(row, { isMutual: false });
    expect(row.profilePhoto).toBe('https://cdn/x.jpg');
    expect(row.quizAnswers).toEqual([1, 2]);
  });
});

describe('stripOwnerOnlyKeys', () => {
  it('strips in place, for the getProfile path that keeps its own blur/intro logic', () => {
    const row = fullRow();
    stripOwnerOnlyKeys(row);
    expect(row).not.toHaveProperty('quizAnswers');
    expect(row.lifestylePreferences).toEqual({ diet: 'veg' });
    // getProfile still needs this one for its own social-link visibility pass.
    expect(row).toHaveProperty('socialMediaLinks');
  });
});

describe('listingScope', () => {
  const ctx = (over = {}) => ({ viewerId: ME, blockedIds: [], mutualIds: new Set(), ...over });

  it('hides incognito members from discovery but not from a direct code lookup', () => {
    expect(listingScope(ctx()).incognitoMode).toEqual({ [Op.ne]: true });
    expect(listingScope(ctx(), { includeIncognito: true })).not.toHaveProperty('incognitoMode');
  });

  it('excludes the viewer and everyone in a block relationship', () => {
    const { userId } = listingScope(ctx({ blockedIds: [A] }));
    expect(userId[Op.ne]).toBe(ME);
    expect(userId[Op.notIn]).toEqual([A]);
  });

  it('lets a matches-only member through only for a mutual match', () => {
    const scope = listingScope(ctx({ mutualIds: new Set([B]) }));
    const clauses = scope[Op.and][0][Op.or];
    expect(clauses).toEqual(expect.arrayContaining([{ profileVisibility: { [Op.ne]: 'matches_only' } }]));
    expect(clauses).toEqual(expect.arrayContaining([{ userId: { [Op.in]: [B] } }]));
  });

  it('with no mutual matches, a matches-only member is unreachable', () => {
    const clauses = listingScope(ctx())[Op.and][0][Op.or];
    expect(clauses.some((c) => c.userId)).toBe(false);
  });
});

describe('stillVisible (daily-set revalidation)', () => {
  it('drops candidates that are no longer listable', async () => {
    models.Profile.findAll.mockResolvedValue([{ userId: A }]); // B failed the current scope
    const kept = await stillVisible(ME, [{ userId: A }, { userId: B }]);
    expect(kept.map((i) => i.userId)).toEqual([A]);
  });

  it('asks the database with the SAME scope as live discovery', async () => {
    models.Block.findAll.mockResolvedValue([{ blockerId: ME, blockedUserId: B }]);
    models.Profile.findAll.mockResolvedValue([]);
    await stillVisible(ME, [{ userId: A }]);
    const { where, include } = models.Profile.findAll.mock.calls[0][0];
    expect(where.isActive).toBe(true);
    expect(where.incognitoMode).toEqual({ [Op.ne]: true });
    expect(where.userId[Op.notIn]).toEqual([B]);
    expect(include[0].where).toEqual({ status: 'active' });
  });

  it('applies photo blur switched on AFTER the set was cached', async () => {
    models.Profile.findAll.mockResolvedValue([
      { userId: A, photoBlurUntilMatch: true },
      { userId: B, photoBlurUntilMatch: false },
    ]);
    const kept = await stillVisible(ME, [
      { userId: A, profilePhoto: 'https://cdn/a.jpg', photos: ['https://cdn/a.jpg'] },
      { userId: B, profilePhoto: 'https://cdn/b.jpg', photos: ['https://cdn/b.jpg'] },
    ]);
    expect(kept[0]).toMatchObject({ userId: A, profilePhoto: null, photos: [] });
    expect(kept[1]).toMatchObject({ userId: B, profilePhoto: 'https://cdn/b.jpg' });
  });

  it('shows the photos the member has NOW, not the ones cached this morning', async () => {
    models.Profile.findAll.mockResolvedValue([
      { userId: A, photoBlurUntilMatch: false, profilePhoto: 'https://cdn/a2.jpg', photos: ['https://cdn/a2.jpg'] },
      { userId: B, photoBlurUntilMatch: false, profilePhoto: null, photos: [] },
    ]);
    const kept = await stillVisible(ME, [
      { userId: A, firstName: 'Asha', profilePhoto: 'https://cdn/a1.jpg', photos: ['https://cdn/a1.jpg', 'https://cdn/a2.jpg'] },
      { userId: B, profilePhoto: 'https://cdn/deleted.jpg', photos: ['https://cdn/deleted.jpg'] },
    ]);
    expect(kept[0]).toMatchObject({ userId: A, firstName: 'Asha', profilePhoto: 'https://cdn/a2.jpg', photos: ['https://cdn/a2.jpg'] });
    expect(kept[1]).toMatchObject({ userId: B, profilePhoto: null, photos: [] });
    expect(models.Profile.findAll.mock.calls[0][0].attributes).toEqual(expect.arrayContaining(['profilePhoto', 'photos']));
  });

  it('is a no-op (and costs no query) for an empty set', async () => {
    expect(await stillVisible(ME, [])).toEqual([]);
    expect(models.Profile.findAll).not.toHaveBeenCalled();
  });
});

describe('GET /match/daily', () => {
  it('re-checks a cached set instead of trusting it for the whole day', async () => {
    getOrSet.mockResolvedValue([{ userId: A }, { userId: B }]);
    models.Subscription.findOne.mockResolvedValue(null);
    models.Profile.findAll.mockResolvedValue([{ userId: A }]); // B went matches-only / was erased

    const { res } = await run(match.getDailyMatches, { user: { id: ME } });

    const body = res.json.mock.calls[0][0];
    expect(body.matches.map((m) => m.userId)).toEqual([A]);
    expect(body.totalAvailable).toBe(1);
  });
});

// A member whose age can be checked: date of birth and gender on file.
const ADULT = { dateOfBirth: '1995-01-01', gender: 'female' };

describe('POST /match/:userId target checks', () => {
  const act = (userId, action = 'like') =>
    run(match.matchAction, { params: { userId }, body: { action }, user: { id: ME } });

  // matchAction also reads the ACTOR's own profile (a paused member may not send
  // interests), so Profile.findOne is answered per userId: the acting member is
  // always visible here, and each test controls what the TARGET's row says.
  const targetProfile = (value) => models.Profile.findOne.mockImplementation(async (query) => (
    query && query.where && query.where.userId === ME ? { isActive: true, pausedAt: null, ...ADULT } : value
  ));

  beforeEach(() => {
    models.Block.findOne.mockResolvedValue(null);
    models.User.findByPk.mockResolvedValue({ id: A, status: 'active', role: 'user' });
    targetProfile({ isActive: true, profileVisibility: 'everyone', ...ADULT });
  });

  it('refuses to act on yourself', async () => {
    const { thrown } = await act(ME);
    expect(thrown).toMatchObject({ statusCode: 400 });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['no such user', () => models.User.findByPk.mockResolvedValue(null)],
    ['banned user', () => models.User.findByPk.mockResolvedValue({ id: A, status: 'banned', role: 'user' })],
    ['staff account', () => models.User.findByPk.mockResolvedValue({ id: A, status: 'active', role: 'admin' })],
    ['no profile', () => targetProfile(null)],
    ['deactivated profile', () => targetProfile({ isActive: false })],
  ])('404s for %s, with no write', async (_label, setup) => {
    setup();
    const { thrown } = await act(A);
    expect(thrown).toMatchObject({ statusCode: 404 });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('404s for a matches-only member who has not liked the viewer', async () => {
    targetProfile({ isActive: true, profileVisibility: 'matches_only', ...ADULT });
    models.Match.findOne.mockResolvedValue(null);
    const { thrown } = await act(A);
    expect(thrown).toMatchObject({ statusCode: 404 });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('404s for a member whose age cannot be checked (no date of birth), with no write', async () => {
    targetProfile({ isActive: true, profileVisibility: 'everyone', dateOfBirth: null, gender: 'female' });
    const { thrown } = await act(A);
    expect(thrown).toMatchObject({ statusCode: 404 });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('403s when the ACTING member has no date of birth or gender yet, with no write', async () => {
    models.Profile.findOne.mockImplementation(async (query) => (
      query && query.where && query.where.userId === ME
        ? { isActive: true, pausedAt: null, dateOfBirth: null, gender: null }
        : { isActive: true, profileVisibility: 'everyone', ...ADULT }
    ));
    const { thrown } = await act(A);
    expect(thrown).toMatchObject({ statusCode: 403, code: 'PROFILE_INCOMPLETE' });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('checks for an inbound like from that member, and only a like', async () => {
    targetProfile({ isActive: true, profileVisibility: 'matches_only', ...ADULT });
    models.Match.findOne.mockResolvedValue(null);
    await act(A);
    expect(models.Match.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: A, matchedUserId: ME, action: 'like' } })
    );
  });
});
