/**
 * P1-5: ranked search orders the WHOLE candidate pool, not each page of 20
 * newest-first rows, and every result says why it sits where it does.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(), logSecurity: jest.fn(),
}));

// Newest first (the SQL order); compatibility is set so the BEST rows are the
// OLDEST, i.e. they would never reach page 1 under per-page sorting.
const POOL = Array.from({ length: 45 }, (_, i) => ({
  userId: `u${i}`,
  photos: ['x.jpg'],
  score: i, // older row => higher score
  User: { id: `u${i}`, isBoosted: false },
  toJSON() { return { userId: this.userId, photos: this.photos, User: this.User }; },
}));

jest.mock('../../utils/compatibility', () => ({
  calculateCompatibility: (_me, other) => other.score,
  isManglikCompatible: () => true,
}));

const mockProfile = {
  findOne: jest.fn(async () => ({ userId: 'me', gender: 'male' })),
  findAll: jest.fn(async (opts) => (opts.limit >= 45 ? POOL : POOL.slice(opts.offset || 0, (opts.offset || 0) + opts.limit))),
  count: jest.fn(async () => 45),
};
jest.mock('../../models', () => ({
  Profile: mockProfile,
  User: {},
  Match: { findAll: jest.fn(async () => []) },
  Subscription: { findAll: jest.fn(async () => []) },
  Verification: { findAll: jest.fn(async () => []) },
}));
jest.mock('../../utils/profileVisibility', () => ({
  loadViewerContext: jest.fn(async () => ({})),
  listingScope: jest.fn(() => ({})),
  viewerHasPaidAccess: jest.fn(async () => false),
  redactForViewer: (raw) => raw,
  // The card projection has its own test (cardProfile.test.js); ranking is under test here.
  toCardProfile: (data) => data,
}));

const { searchProfiles } = require('../../controllers/searchController');

const run = async (query) => {
  const res = { json: jest.fn() };
  await searchProfiles({ user: { id: 'me' }, query }, res, jest.fn());
  await new Promise((r) => setImmediate(r));
  return res.json.mock.calls[0][0];
};

describe('ranked search', () => {
  beforeEach(() => mockProfile.findAll.mockClear());

  it('page 1 holds the best matches of the whole pool, not the newest 20', async () => {
    const body = await run({ sortBy: 'compatibility', page: '1', limit: '20' });
    expect(body.profiles.map((p) => p.compatibilityScore)).toEqual(
      Array.from({ length: 20 }, (_, i) => 44 - i)
    );
  });

  it('page 2 continues the same global order with no repeats', async () => {
    const p1 = await run({ sortBy: 'compatibility', page: '1', limit: '20' });
    const p2 = await run({ sortBy: 'compatibility', page: '2', limit: '20' });
    expect(p2.profiles[0].compatibilityScore).toBe(24);
    const ids = new Set([...p1.profiles, ...p2.profiles].map((p) => p.userId));
    expect(ids.size).toBe(40);
    expect(Math.max(...p2.profiles.map((p) => p.compatibilityScore)))
      .toBeLessThan(Math.min(...p1.profiles.map((p) => p.compatibilityScore)));
  });

  it('pulls the pool in SQL only for ranked search; column sorts still page in SQL', async () => {
    await run({ sortBy: 'compatibility', page: '1', limit: '20' });
    expect(mockProfile.findAll.mock.calls[0][0].limit).toBe(500);
    expect(mockProfile.findAll.mock.calls[0][0].offset).toBe(0);
    mockProfile.findAll.mockClear();
    await run({ sortBy: 'recent', page: '2', limit: '20' });
    expect(mockProfile.findAll.mock.calls[0][0].limit).toBe(20);
    expect(mockProfile.findAll.mock.calls[0][0].offset).toBe(20);
  });

  it('every result explains its position', async () => {
    const body = await run({ sortBy: 'compatibility', page: '1', limit: '5' });
    const first = body.profiles[0];
    expect(first.rankScore).toBe(44);
    expect(first.rankFactors[0]).toEqual({ key: 'compatibility', label: 'Profile match', points: 44 });
    expect(first.rankFactors.reduce((n, f) => n + f.points, 0)).toBe(first.rankScore);
  });

  it('reports pages for the ranked pool and says when it is capped', async () => {
    const body = await run({ sortBy: 'compatibility', page: '1', limit: '20' });
    expect(body.pagination).toMatchObject({ total: 45, pages: 3, capped: false });
  });
});
