/**
 * Socket room authorization + handler hardening (platform audit 2026-09-29,
 * P0-1 / P0-2 / P0-3 socket leg).
 *
 * join-room used to split the client's room string on `_room_`, verify a mutual
 * match with the first id that was not the caller, then join the WHOLE string.
 * A member matched with X could therefore join `X_room_Y` and receive a
 * conversation they were never in. It now accepts only the canonical room of
 * two verified participants, one of whom is the caller, and joins the room the
 * server derived.
 *
 * socket.io does not catch a rejected async handler, and server.js treats any
 * unhandled rejection as fatal, so a payload-less `typing` emit from any logged
 * in socket used to be a one-message denial of service.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
}));

const mockUser = { findByPk: jest.fn(), count: jest.fn() };
const mockMatch = { findOne: jest.fn(), findAll: jest.fn() };
const mockBlock = { findOne: jest.fn(), findAll: jest.fn() };
jest.mock('../../models', () => ({
  Match: mockMatch,
  Block: mockBlock,
  GroupMember: { findOne: jest.fn() },
  User: mockUser,
  Profile: { findAll: jest.fn() },
}));

jest.mock('../../utils/entitlements', () => ({
  hasChatAccess: jest.fn().mockResolvedValue({ allowed: true }),
  getActiveSubscription: jest.fn().mockResolvedValue(null),
}));

const initializeSocket = require('../../socket/socketHandler');

// Fixed, sortable ids: ME < OTHER < STRANGER.
const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const room = (a, b) => [a, b].sort().join('_room_');

let teardown = null;

const connect = async (userId = ME) => {
  let onConnection;
  const io = {
    use: jest.fn(),
    on: jest.fn((event, fn) => { if (event === 'connection') onConnection = fn; }),
    to: jest.fn(() => ({ emit: jest.fn() })),
    sockets: { adapter: { rooms: new Map() } },
  };
  teardown = initializeSocket(io);

  const handlers = {};
  const relayed = { emit: jest.fn() };
  const socket = {
    id: `sock-${Math.random()}`,
    userId,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    to: jest.fn(() => relayed),
    on: jest.fn((event, fn) => { handlers[event] = fn; }),
  };
  await onConnection(socket);
  // Connecting joins the caller's own user_<id> room; only later joins matter here.
  socket.join.mockClear();
  return { socket, handlers, relayed };
};

// The caller (ME) is mutual with OTHER only.
const matchOnlyWithOther = ({ where }) => {
  const pairs = where[Object.getOwnPropertySymbols(where)[0]];
  const hit = pairs.some((p) => [p.userId, p.matchedUserId].sort().join() === [ME, OTHER].sort().join());
  return Promise.resolve(hit ? { id: 'm1' } : null);
};

beforeEach(() => {
  mockUser.findByPk.mockResolvedValue({ id: ME, status: 'active' });
  // bothMembers (utils/memberRole): both sides of the pair are member accounts.
  mockUser.count.mockResolvedValue(2);
  mockMatch.findOne.mockImplementation(matchOnlyWithOther);
  mockMatch.findAll.mockResolvedValue([]);
  mockBlock.findOne.mockResolvedValue(null);
});

afterEach(() => {
  jest.clearAllMocks();
  if (typeof teardown === 'function') teardown();
  teardown = null;
});

describe('join-room authorization', () => {
  it('joins the canonical room for a real mutual match', async () => {
    const { socket, handlers } = await connect();
    await handlers['join-room'](room(ME, OTHER));
    expect(socket.join).toHaveBeenCalledWith(room(ME, OTHER));
  });

  it('refuses the room when the "mutual match" is a staff account', async () => {
    mockUser.count.mockResolvedValue(1); // only one of the pair is a member
    const { socket, handlers } = await connect();
    await handlers['join-room'](room(ME, OTHER));
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'NOT_MATCHED' }));
  });

  it("refuses a room between two OTHER members, even when the caller is matched with one of them", async () => {
    // The exploit: ME is mutual with OTHER, so `OTHER_room_STRANGER` passed the
    // old check (it verified ME<->OTHER) and then joined the whole string.
    const { socket, handlers } = await connect();
    await handlers['join-room'](room(OTHER, STRANGER));
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'INVALID_ROOM' }));
  });

  it.each([
    ['extra segment', `${ME}_room_${OTHER}_room_${STRANGER}`],
    ['non-uuid part', `${ME}_room_not-a-uuid`],
    ['same id twice', `${ME}_room_${ME}`],
    ['empty string', ''],
    ['no separator', ME],
    ['non-canonical order', `${OTHER}_room_${ME}`],
    ['trailing junk', `${room(ME, OTHER)} `],
  ])('rejects a malformed room: %s', async (_label, bad) => {
    const { socket, handlers } = await connect();
    await handlers['join-room'](bad);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it.each([[undefined], [null], [42], [{ a: 1 }], [['x']]])('rejects a non-string room (%p)', async (bad) => {
    const { socket, handlers } = await connect();
    await handlers['join-room'](bad);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('refuses a room when either member has blocked the other, despite the match row', async () => {
    mockBlock.findOne.mockResolvedValue({ id: 'b1' });
    const { socket, handlers } = await connect();
    await handlers['join-room'](room(ME, OTHER));
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'NOT_MATCHED' }));
  });
});

describe('typing indicator', () => {
  it('relays to a mutual match', async () => {
    const { handlers, relayed } = await connect();
    await handlers.typing({ receiverId: OTHER, isTyping: true });
    expect(relayed.emit).toHaveBeenCalledWith('user_typing', { userId: ME, isTyping: true });
  });

  it.each([[undefined], [null], ['x'], [42], [{}], [{ receiverId: 42 }], [{ receiverId: "'; DROP" }]])(
    'survives a hostile payload (%p) without throwing or relaying',
    async (payload) => {
      const { handlers, relayed } = await connect();
      await expect(handlers.typing(payload)).resolves.toBeUndefined();
      expect(relayed.emit).not.toHaveBeenCalled();
    }
  );

  it('does not relay across a block', async () => {
    mockBlock.findOne.mockResolvedValue({ id: 'b1' });
    const { handlers, relayed } = await connect();
    await handlers.typing({ receiverId: OTHER, isTyping: true });
    expect(relayed.emit).not.toHaveBeenCalled();
  });

  it('coerces a non-boolean isTyping instead of relaying attacker-controlled data', async () => {
    const { handlers, relayed } = await connect();
    await handlers.typing({ receiverId: OTHER, isTyping: { evil: true } });
    expect(relayed.emit).toHaveBeenCalledWith('user_typing', { userId: ME, isTyping: false });
  });
});

describe('get-online-status', () => {
  it('drops malformed ids before they reach a uuid column', async () => {
    const { socket, handlers } = await connect();
    await handlers['get-online-status'](['not-a-uuid', 42, "1' OR '1'='1"]);
    expect(mockMatch.findAll).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('online-status', {});
  });

  it('turns a failing query into an error event instead of an unhandled rejection', async () => {
    mockMatch.findAll.mockRejectedValue(new Error('db down'));
    const { socket, handlers } = await connect();
    await expect(handlers['get-online-status']([OTHER])).resolves.toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'SOCKET_ERROR' }));
  });
});
