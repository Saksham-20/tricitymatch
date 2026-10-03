/**
 * P1-9: interest transitions. A repeated like announces nothing, leaving 'like'
 * while mutual withdraws the match, and the pair is serialised so two members
 * liking each other at once still end up mutual.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

// ── in-memory Matches table ─────────────────────────────────────────────────
const mockRows = new Map();
const mockKey = (u, m) => `${u}>${m}`;
const mockMkRow = (r) => {
  const row = {
    id: `id-${mockRows.size + 1}`, isMutual: false, mutualMatchDate: null, note: null, likedItem: null, compatibilityScore: null,
    ...r,
    save: async function save() { return this; },
  };
  mockRows.set(mockKey(row.userId, row.matchedUserId), row);
  return row;
};

const mockLockQueries = [];
const mockNotify = jest.fn(async () => {});
const mockSendMail = jest.fn(async () => {});
const mockSever = jest.fn(async (a, b) => {
  for (const r of mockRows.values()) {
    if (r.isMutual && ((r.userId === a && r.matchedUserId === b) || (r.userId === b && r.matchedUserId === a))) {
      r.isMutual = false; r.mutualMatchDate = null;
    }
  }
});
const mockEvict = jest.fn();

jest.mock('../../utils/relationship', () => ({
  severRelationshipRows: (...a) => mockSever(...a),
  evictChatRoom: (...a) => mockEvict(...a),
}));
jest.mock('../../utils/notifyUser', () => ({ notify: (...a) => mockNotify(...a) }));
jest.mock('../../utils/emailService', () => ({ sendMatchNotification: (...a) => mockSendMail(...a) }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/cache', () => ({ getOrSet: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() }));
jest.mock('../../utils/compatibility', () => ({
  calculateCompatibility: () => 70, getCompatibilityBreakdown: jest.fn(), deriveReasons: jest.fn(),
}));
jest.mock('../../utils/profileVisibility', () => ({
  loadViewerContext: jest.fn(), listingScope: jest.fn(), matchesOnlyClause: jest.fn(),
  stillVisible: jest.fn(), viewerHasPaidAccess: jest.fn(), redactForViewer: jest.fn(),
}));
jest.mock('../../config/env', () => ({ server: { frontendUrl: 'http://x' }, features: {} }));
jest.mock('../../config/database', () => ({
  transaction: async (fn) => fn({ LOCK: {} }),
  query: async (sql, opts = {}) => {
    if (/pg_advisory_xact_lock/.test(sql)) { mockLockQueries.push(opts.replacements.pairKey); return []; }
    if (/INSERT INTO "Matches"/.test(sql)) {
      const r = opts.replacements;
      const existing = mockRows.get(mockKey(r.userId, r.matchedUserId));
      if (existing) existing.action = r.action; else mockMkRow({ userId: r.userId, matchedUserId: r.matchedUserId, action: r.action });
      return [];
    }
    return [];
  },
}));
jest.mock('../../models', () => ({
  Block: { findOne: async () => null },
  User: { findByPk: async (id) => ({ id, status: 'active', email: `${id.slice(0, 1)}@x.co` }) },
  Profile: { findOne: async ({ where }) => ({ userId: where.userId, isActive: true, profileVisibility: 'everyone', dateOfBirth: '1995-01-01', gender: 'female', firstName: where.userId === A ? 'Asha' : 'Bala', lastName: 'K', photos: [], profilePrompts: {} }) },
  Match: {
    findOne: async ({ where }) => {
      const row = mockRows.get(mockKey(where.userId, where.matchedUserId));
      if (!row) return null;
      if (where.action && row.action !== where.action) return null;
      return row;
    },
  },
  Subscription: {}, Verification: {},
}));

const { matchAction } = require('../../controllers/matchController');

const act = async (from, to, action) => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  matchAction({ params: { userId: to }, body: { action }, user: { id: from } }, res, next);
  await new Promise((r) => setTimeout(r, 25)); // transaction + setImmediate notifications
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res.json.mock.calls[0][0];
};

beforeEach(() => {
  mockRows.clear();
  mockLockQueries.length = 0;
  jest.clearAllMocks();
});

describe('match transitions', () => {
  it('a first like is one-way and tells the other member once', async () => {
    const out = await act(A, B, 'like');
    expect(out).toMatchObject({ isMutual: false, newMatch: false, withdrawn: false });
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(B, 'new_match', 'Someone liked your profile!', expect.any(String), expect.anything(), { category: 'interests' });
  });

  it('liking again does not announce again', async () => {
    await act(A, B, 'like');
    mockNotify.mockClear();
    await act(A, B, 'like');
    await act(A, B, 'like');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('a like returned makes the match mutual once, notifying both and mailing both', async () => {
    await act(A, B, 'like');
    mockNotify.mockClear();
    const out = await act(B, A, 'like');
    expect(out).toMatchObject({ isMutual: true, newMatch: true });
    expect(mockRows.get(mockKey(A, B)).isMutual).toBe(true);
    expect(mockRows.get(mockKey(B, A)).isMutual).toBe(true);
    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it('a repeated like on a mutual match is idempotent: no new date, no second announcement', async () => {
    await act(A, B, 'like');
    await act(B, A, 'like');
    const date = mockRows.get(mockKey(A, B)).mutualMatchDate;
    mockNotify.mockClear(); mockSendMail.mockClear();

    const out = await act(A, B, 'like');
    expect(out).toMatchObject({ isMutual: true, newMatch: false });
    expect(mockRows.get(mockKey(A, B)).mutualMatchDate).toBe(date);
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it.each(['pass', 'shortlist'])('%s on a mutual match withdraws it for both members', async (action) => {
    await act(A, B, 'like');
    await act(B, A, 'like');
    mockNotify.mockClear();

    const out = await act(A, B, action);
    expect(out).toMatchObject({ isMutual: false, withdrawn: true, newMatch: false });
    expect(mockRows.get(mockKey(A, B)).isMutual).toBe(false);
    expect(mockRows.get(mockKey(B, A)).isMutual).toBe(false);
    expect(mockSever).toHaveBeenCalledWith(A, B, expect.objectContaining({ clearMutualDate: true }));
    expect(mockEvict).toHaveBeenCalledWith(A, B);
    // The other member's like stands as an ordinary one-way like.
    expect(mockRows.get(mockKey(B, A)).action).toBe('like');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('passing on a one-way like tears nothing down', async () => {
    await act(A, B, 'like');
    await act(A, B, 'pass');
    expect(mockSever).not.toHaveBeenCalled();
    expect(mockEvict).not.toHaveBeenCalled();
  });

  it('declining an incoming like is just a pass and does not create a match', async () => {
    await act(A, B, 'like');
    const out = await act(B, A, 'pass');
    expect(out).toMatchObject({ isMutual: false, newMatch: false });
    expect(mockRows.get(mockKey(A, B)).isMutual).toBe(false);
  });

  it('can match again after a withdrawal when the like is renewed', async () => {
    await act(A, B, 'like');
    await act(B, A, 'like');
    await act(A, B, 'pass');
    mockNotify.mockClear();
    const out = await act(A, B, 'like');
    expect(out).toMatchObject({ isMutual: true, newMatch: true });
    expect(mockNotify).toHaveBeenCalledTimes(2);
  });

  it('serialises each pair under one lock key, whichever member acts', async () => {
    await act(A, B, 'like');
    await act(B, A, 'like');
    expect(mockLockQueries).toHaveLength(2);
    expect(new Set(mockLockQueries).size).toBe(1);
  });
});
