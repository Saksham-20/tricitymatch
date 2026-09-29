/**
 * Erasure removes what the database transaction cannot (audit P0-7).
 *
 * The transaction removed rows; files stayed on public URLs, live sockets kept
 * receiving events, the lead/enquiry copies of the member's identity survived,
 * and the erased profile stayed in other members' cached daily sets.
 */

const order = [];

jest.mock('../../config/database', () => ({
  transaction: jest.fn(async (fn) => { order.push('txn:start'); const r = await fn('TXN'); order.push('txn:commit'); return r; }),
  query: jest.fn(),
}));

// Evidence snapshotting has its own suite (moderationWorkflow.test.js); here it
// is a stub so these tests keep asserting what they always asserted.
const mockPreserve = jest.fn().mockResolvedValue({ archived: 0 });
jest.mock('../../utils/evidencePreservation', () => ({ preserveEvidence: (...a) => mockPreserve(...a) }));

jest.mock('../../models', () => {
  const d = () => ({ destroy: jest.fn().mockResolvedValue(1) });
  return {
    Profile: d(), Verification: d(), GuardianLink: d(), ProfileView: d(), Match: d(),
    ContactUnlock: d(), Notification: d(), RefreshToken: d(), CallSession: d(),
    AnalyticsEvent: d(), ChatGrant: d(), Block: d(), GroupMember: d(), MediaReview: d(),
  };
});

const mockCollect = jest.fn();
const mockDestroy = jest.fn();
jest.mock('../../utils/memberMedia', () => ({
  collectMemberMedia: (...a) => { order.push('media:collect'); return mockCollect(...a); },
  destroyMedia: (...a) => { order.push('media:destroy'); return mockDestroy(...a); },
}));

const mockDisconnect = jest.fn();
const mockIn = jest.fn(() => ({ disconnectSockets: mockDisconnect }));
jest.mock('../../utils/socket', () => ({ getIO: jest.fn(() => ({ in: mockIn })) }));

const mockDelPattern = jest.fn().mockResolvedValue(0);
jest.mock('../../utils/cache', () => ({ delPattern: (...a) => mockDelPattern(...a) }));

const sequelize = require('../../config/database');
const { eraseAccount } = require('../../utils/accountErasure');

const USER = '11111111-2222-4333-8444-555555555555';
const summary = (over = {}) => ({ deleted: 0, alreadyGone: 0, local: 0, skipped: 0, failed: [], ...over });

beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  sequelize.query.mockImplementation(async (sql) => {
    if (sql.includes('SELECT "email", "phone" FROM "Users"')) return [[{ email: 'asha@example.com', phone: '9876543210' }], {}];
    return [[], {}];
  });
  mockCollect.mockResolvedValue(['https://res.cloudinary.com/demo/image/upload/v1/a/b.jpg']);
  mockDestroy.mockResolvedValue(summary({ deleted: 1 }));
});

describe('erasure and uploaded files', () => {
  it('collects the URLs BEFORE the rows go and destroys the files AFTER the commit', async () => {
    await eraseAccount(USER);
    expect(order.indexOf('media:collect')).toBeLessThan(order.indexOf('txn:start'));
    expect(order.indexOf('media:destroy')).toBeGreaterThan(order.indexOf('txn:commit'));
  });

  it('destroys exactly the collected URLs', async () => {
    await eraseAccount(USER);
    expect(mockDestroy).toHaveBeenCalledWith(['https://res.cloudinary.com/demo/image/upload/v1/a/b.jpg']);
  });

  it('reports file deletion in the result', async () => {
    const counts = await eraseAccount(USER);
    expect(counts.media).toMatchObject({ deleted: 1, failed: 0 });
    expect(counts).not.toHaveProperty('mediaFailed');
  });

  it('a CDN failure never fails the erasure, and lists what to retry', async () => {
    mockDestroy.mockResolvedValue(summary({ failed: [{ publicId: 'a/b', resourceType: 'image', error: 'down' }] }));
    const counts = await eraseAccount(USER);
    expect(counts.media.failed).toBe(1);
    expect(counts.mediaFailed).toEqual([{ publicId: 'a/b', resourceType: 'image', error: 'down' }]);
  });
});

describe('erasure and copies of the member\'s identity', () => {
  const inTxn = (needle) => sequelize.query.mock.calls.find(([sql]) => sql.includes(needle));

  it('scrubs the referral lead by conversion, email or phone — inside the transaction', async () => {
    await eraseAccount(USER);
    const [sql, opts] = inTxn('UPDATE "MarketingLeads"');
    expect(sql).toContain('"convertedUserId" = :userId');
    expect(sql).toContain('"name" = :deleted');
    // phone is NOT NULL on MarketingLeads (found by running this against a real
    // database: a mocked query cannot tell) so it is blanked, not nulled.
    expect(sql).toContain(`"phone" = ''`);
    expect(opts.transaction).toBe('TXN');
    expect(opts.replacements).toMatchObject({ userId: USER, emails: ['asha@example.com'], phone: '9876543210' });
  });

  it('anonymises support enquiries from the member, keeping the enquiry itself', async () => {
    await eraseAccount(USER);
    const [sql, opts] = inTxn('UPDATE "ContactMessages"');
    expect(sql).toContain('"ipAddress" = NULL');
    expect(sql).not.toContain('"message" =');
    expect(sql).not.toContain('DELETE');
    expect(opts.transaction).toBe('TXN');
  });

  it('still works when the member has no email or phone on record', async () => {
    sequelize.query.mockImplementation(async (sql) => (sql.includes('SELECT "email", "phone"') ? [[{}], {}] : [[], {}]));
    await expect(eraseAccount(USER)).resolves.toBeDefined();
    const [, opts] = inTxn('UPDATE "MarketingLeads"');
    expect(opts.replacements).toMatchObject({ emails: [null], phone: null });
  });
});

describe('erasure and live state', () => {
  it('disconnects the member\'s live sockets', async () => {
    await eraseAccount(USER);
    expect(mockIn).toHaveBeenCalledWith(`user_${USER}`);
    expect(mockDisconnect).toHaveBeenCalledWith(true);
  });

  it('purges the member\'s own cached daily sets', async () => {
    await eraseAccount(USER);
    expect(mockDelPattern).toHaveBeenCalledWith(`daily-matches:*:${USER}:*`);
  });

  it('a socket or cache failure does not undo or fail the erasure', async () => {
    mockDisconnect.mockImplementation(() => { throw new Error('io gone'); });
    mockDelPattern.mockRejectedValue(new Error('redis down'));
    await expect(eraseAccount(USER)).resolves.toBeDefined();
    mockDisconnect.mockReset();
    mockDelPattern.mockResolvedValue(0);
  });
});
