/**
 * Shared profile-visibility gate (H-3).
 *
 * compatibility / horoscope-match / kundli-PDF used to fetch the target with a
 * bare Profile.findOne, skipping every gate getProfile enforces. The Kundli PDF
 * renders full name, exact DOB and place of birth, so that was an enumeration
 * oracle over the whole user table. These tests pin each gate.
 */

jest.mock('../../models', () => ({
  Profile: { findOne: jest.fn() },
  User: {},
  ProfileView: {},
  Subscription: {},
  Match: { findOne: jest.fn() },
  ContactUnlock: {},
  Block: { findOne: jest.fn() },
  Verification: {},
}));

jest.mock('../../config/database', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('../../middlewares/upload', () => ({ deleteFromCloudinary: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));

const { Profile, Match, Block } = require('../../models');
const { assertProfileVisible } = require('../../controllers/profileController');

const VIEWER = 'viewer-id';
const TARGET = 'target-id';

const visibleProfile = (overrides = {}) => ({
  userId: TARGET,
  profileVisibility: 'everyone',
  ...overrides,
});

describe('assertProfileVisible', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Block.findOne.mockResolvedValue(null);
    Match.findOne.mockResolvedValue(null);
  });

  it('only ever queries active profiles on active accounts', async () => {
    Profile.findOne.mockResolvedValue(visibleProfile());
    await assertProfileVisible(VIEWER, TARGET);

    const where = Profile.findOne.mock.calls[0][0];
    expect(where.where).toMatchObject({ userId: TARGET, isActive: true });
    // Inner join on User.status='active' — a deleted/suspended account must not
    // be readable just because the caller still has the direct URL.
    expect(where.include[0]).toMatchObject({ where: { status: 'active' }, required: true });
  });

  it('404s when the target profile is absent or inactive', async () => {
    Profile.findOne.mockResolvedValue(null);
    await expect(assertProfileVisible(VIEWER, TARGET)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('403s when a block exists in either direction', async () => {
    Profile.findOne.mockResolvedValue(visibleProfile());
    Block.findOne.mockResolvedValue({ id: 'block-1' });

    await expect(assertProfileVisible(VIEWER, TARGET)).rejects.toMatchObject({ statusCode: 403 });

    // Bidirectional: the gate must not care who blocked whom.
    const orClause = Block.findOne.mock.calls[0][0].where[Object.getOwnPropertySymbols(
      Block.findOne.mock.calls[0][0].where
    )[0]];
    expect(orClause).toEqual([
      { blockerId: VIEWER, blockedUserId: TARGET },
      { blockerId: TARGET, blockedUserId: VIEWER },
    ]);
  });

  it('403s on matches_only for a non-mutual viewer', async () => {
    Profile.findOne.mockResolvedValue(visibleProfile({ profileVisibility: 'matches_only' }));
    Match.findOne.mockResolvedValue(null);

    await expect(assertProfileVisible(VIEWER, TARGET)).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROFILE_MATCHES_ONLY',
    });
  });

  it('admits a mutual match through matches_only', async () => {
    Profile.findOne.mockResolvedValue(visibleProfile({ profileVisibility: 'matches_only' }));
    Match.findOne.mockResolvedValue({ isMutual: true });

    const { isMutual } = await assertProfileVisible(VIEWER, TARGET);
    expect(isMutual).toBe(true);
  });

  it('admits an admin through matches_only', async () => {
    Profile.findOne.mockResolvedValue(visibleProfile({ profileVisibility: 'matches_only' }));
    Match.findOne.mockResolvedValue(null);

    await expect(
      assertProfileVisible(VIEWER, TARGET, { viewerRole: 'super_admin' })
    ).resolves.toBeDefined();
  });

  it('lets a member view their OWN matches_only profile', async () => {
    // getProfile short-circuits self-view to getMyProfile; without the same
    // guard here, a matches_only member got 403 on their own compatibility.
    Profile.findOne.mockResolvedValue(visibleProfile({ userId: VIEWER, profileVisibility: 'matches_only' }));
    Match.findOne.mockResolvedValue(null);

    await expect(assertProfileVisible(VIEWER, VIEWER)).resolves.toMatchObject({ isSelf: true });
  });

  it('can skip the matches_only preference for already-paid access', async () => {
    // Contact details already unlocked: flipping to matches_only is a discovery
    // preference and must not retroactively confiscate a purchase.
    Profile.findOne.mockResolvedValue(visibleProfile({ profileVisibility: 'matches_only' }));
    Match.findOne.mockResolvedValue(null);

    await expect(
      assertProfileVisible(VIEWER, TARGET, { enforceVisibilityPreference: false })
    ).resolves.toBeDefined();
  });

  it('still enforces blocks even for already-paid access', async () => {
    Profile.findOne.mockResolvedValue(visibleProfile({ profileVisibility: 'matches_only' }));
    Block.findOne.mockResolvedValue({ id: 'block-1' });

    await expect(
      assertProfileVisible(VIEWER, TARGET, { enforceVisibilityPreference: false })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('still enforces account status even for already-paid access', async () => {
    // Inner join on status='active' means a deleted account yields no row.
    Profile.findOne.mockResolvedValue(null);

    await expect(
      assertProfileVisible(VIEWER, TARGET, { enforceVisibilityPreference: false })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns the profile for an ordinary visible target', async () => {
    const profile = visibleProfile();
    Profile.findOne.mockResolvedValue(profile);

    await expect(assertProfileVisible(VIEWER, TARGET)).resolves.toMatchObject({
      profile,
      isMutual: false,
    });
  });
});
