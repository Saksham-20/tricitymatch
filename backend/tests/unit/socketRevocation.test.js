/**
 * Socket authorization over a live connection (deep security audit 2026-08-21,
 * R2 AUTHZ-2 / DoS-2).
 *
 * authenticateSocket rejects a non-active account at CONNECT. Sockets are
 * long-lived, so that check answered a question once and never again: a member
 * banned, suspended or self-deleted while connected kept a fully privileged
 * channel — joining rooms, relaying typing, probing presence — until they chose
 * to disconnect. Nothing re-presented the token, so even its 15-minute expiry
 * did not bound it.
 *
 * Separately, join-group ran a GroupMember lookup per emit with no rate limit
 * and no shape check, so any authenticated socket was a database query
 * amplifier and every malformed id cost a round-trip to raise "invalid input
 * syntax for type uuid".
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
}));

const mockUser = { findByPk: jest.fn() };
const mockGroupMember = { findOne: jest.fn() };
jest.mock('../../models', () => ({
  Match: { findOne: jest.fn(), findAll: jest.fn() },
  GroupMember: mockGroupMember,
  User: mockUser,
  Profile: { findAll: jest.fn() },
}));

jest.mock('../../utils/entitlements', () => ({
  hasChatAccess: jest.fn().mockResolvedValue({ allowed: true }),
  getActiveSubscription: jest.fn().mockResolvedValue(null),
}));

const initializeSocket = require('../../socket/socketHandler');

const ACTIVE = { id: 'u1', status: 'active' };
const BANNED = { id: 'u1', status: 'banned' };

// Build a fake io that captures the connection handler, then a fake socket that
// captures each event handler so tests can invoke them directly.
let teardown = null;

const connect = async () => {
  let onConnection;
  const io = {
    use: jest.fn(),
    on: jest.fn((event, fn) => { if (event === 'connection') onConnection = fn; }),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };
  teardown = initializeSocket(io);

  const handlers = {};
  const socket = {
    id: `sock-${Math.random()}`,
    userId: 'u1',
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn((event, fn) => { handlers[event] = fn; }),
  };
  await onConnection(socket);
  return { socket, handlers };
};

afterEach(() => {
  jest.clearAllMocks();
  if (typeof teardown === 'function') teardown();
  teardown = null;
});

describe('mid-session revocation', () => {
  it('disconnects a socket whose account was banned after connecting', async () => {
    const { socket, handlers } = await connect();
    // Connect stamps lastStatusCheck; force the cache to be stale.
    socket.lastStatusCheck = Date.now() - 10 * 60 * 1000;
    mockUser.findByPk.mockResolvedValue(BANNED);

    await handlers['join-group']({ groupId: '11111111-1111-4111-8111-111111111111' });

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(mockGroupMember.findOne).not.toHaveBeenCalled();
  });

  it('lets a still-active member through', async () => {
    const { socket, handlers } = await connect();
    socket.lastStatusCheck = Date.now() - 10 * 60 * 1000;
    mockUser.findByPk.mockResolvedValue(ACTIVE);
    mockGroupMember.findOne.mockResolvedValue({ id: 'm1' });

    await handlers['join-group']({ groupId: '11111111-1111-4111-8111-111111111111' });

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith('group_11111111-1111-4111-8111-111111111111');
  });

  it('fails closed when the status lookup itself errors', async () => {
    const { socket, handlers } = await connect();
    socket.lastStatusCheck = Date.now() - 10 * 60 * 1000;
    mockUser.findByPk.mockRejectedValue(new Error('db down'));

    await handlers['join-group']({ groupId: '11111111-1111-4111-8111-111111111111' });

    expect(mockGroupMember.findOne).not.toHaveBeenCalled();
  });

  it('caches the check so a chatty client does not re-query every emit', async () => {
    const { socket, handlers } = await connect();
    mockUser.findByPk.mockResolvedValue(ACTIVE);
    mockGroupMember.findOne.mockResolvedValue({ id: 'm1' });

    // lastStatusCheck was stamped at connect, so these are all inside the window.
    await handlers['join-group']({ groupId: '11111111-1111-4111-8111-111111111111' });
    await handlers['join-group']({ groupId: '11111111-1111-4111-8111-111111111111' });

    expect(mockUser.findByPk).not.toHaveBeenCalled();
  });
});

describe('join-group input handling', () => {
  it('rejects a non-uuid group id without touching the database', async () => {
    const { socket, handlers } = await connect();

    await handlers['join-group']({ groupId: 'not-a-uuid' });

    expect(mockGroupMember.findOne).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: 'INVALID_GROUP' })
    );
  });

  it('rate limits repeated joins', async () => {
    const { socket, handlers } = await connect();
    mockGroupMember.findOne.mockResolvedValue({ id: 'm1' });
    const id = '11111111-1111-4111-8111-111111111111';

    for (let i = 0; i < 25; i++) await handlers['join-group']({ groupId: id });

    const rateLimited = socket.emit.mock.calls.filter(
      ([event, payload]) => event === 'error' && payload.code === 'RATE_LIMITED'
    );
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

describe('join-room input handling', () => {
  it('does not throw on a non-string room id', async () => {
    const { socket, handlers } = await connect();

    await expect(handlers['join-room']({ nope: true })).resolves.toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: 'INVALID_ROOM' })
    );
  });
});
