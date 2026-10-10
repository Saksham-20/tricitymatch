/**
 * Unread badge push (utils/unreadCounts). Every open web tab used to poll both
 * unread endpoints every 30 s; the server now pushes the number when it changes.
 * The push must go to the member's own room, merge a burst into one query and
 * one emit, never throw into the request that triggered it, and do nothing
 * where there is no Socket.io server.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const load = ({ io = null, notifCount, msgCount, blocked = [] } = {}) => {
  jest.resetModules();
  const Notification = { count: jest.fn(notifCount || (async () => 3)) };
  const Message = { count: jest.fn(msgCount || (async () => 2)) };
  jest.doMock('../../models', () => ({ Notification, Message }));
  jest.doMock('../../utils/blocks', () => ({ blockedIdsFor: jest.fn(async () => new Set(blocked)) }));
  jest.doMock('../../utils/socket', () => ({ getIO: () => io }));
  const mod = require('../../utils/unreadCounts');
  const { log } = require('../../middlewares/logger');
  return { mod, Notification, Message, log };
};

const fakeIO = (rooms) => {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const io = { to };
  if (rooms) io.sockets = { adapter: { rooms } };
  return { io, to, emit };
};

// Let the coalescing timer fire, then let the async count queries settle.
const settle = async () => {
  jest.advanceTimersByTime(400);
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('pushUnreadCounts', () => {
  it('emits unread:counts to the member\'s own room with only the requested kind', async () => {
    const { io, to, emit } = fakeIO();
    const { mod, Notification, Message } = load({ io });
    mod.pushUnreadCounts('u1', 'notifications');
    expect(emit).not.toHaveBeenCalled(); // trailing, not synchronous
    await settle();
    expect(to).toHaveBeenCalledWith('user_u1');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('unread:counts', { notifications: 3 });
    expect(mod.UNREAD_COUNTS_EVENT).toBe('unread:counts');
    expect(Notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', isRead: false } });
    expect(Message.count).not.toHaveBeenCalled();
  });

  it('coalesces a burst into one count per kind and one emit carrying both', async () => {
    const { io, emit } = fakeIO();
    const { mod, Notification, Message } = load({ io });
    for (let i = 0; i < 10; i += 1) mod.pushUnreadCounts('u1', 'notifications');
    mod.pushUnreadCounts('u1', ['chat']);
    await settle();
    expect(Notification.count).toHaveBeenCalledTimes(1);
    expect(Message.count).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('unread:counts', { notifications: 3, chat: 2 });
  });

  it('keeps members separate', async () => {
    const { io, to, emit } = fakeIO();
    const { mod } = load({ io });
    mod.pushUnreadCounts('u1', 'chat');
    mod.pushUnreadCounts('u2', 'chat');
    await settle();
    expect(emit).toHaveBeenCalledTimes(2);
    expect(to.mock.calls.map((c) => c[0]).sort()).toEqual(['user_u1', 'user_u2']);
  });

  it('a push after the window flushed starts a new one', async () => {
    const { io, emit } = fakeIO();
    const { mod } = load({ io });
    mod.pushUnreadCounts('u1', 'chat');
    await settle();
    mod.pushUnreadCounts('u1', 'chat');
    await settle();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('swallows a failing count query and still sends the kinds that worked', async () => {
    const { io, emit } = fakeIO();
    const { mod, log } = load({ io, notifCount: async () => { throw new Error('db down'); } });
    expect(() => mod.pushUnreadCounts('u1', ['notifications', 'chat'])).not.toThrow();
    await settle();
    expect(emit).toHaveBeenCalledWith('unread:counts', { chat: 2 });
    expect(log.warn).toHaveBeenCalled();
  });

  it('sends nothing when every count failed, and never throws', async () => {
    const { io, emit } = fakeIO();
    const { mod } = load({ io, notifCount: async () => { throw new Error('db down'); } });
    mod.pushUnreadCounts('u1', 'notifications');
    await settle();
    expect(emit).not.toHaveBeenCalled();
  });

  it('a throwing emit is swallowed', async () => {
    const io = { to: () => ({ emit: () => { throw new Error('adapter gone'); } }) };
    const { mod, log } = load({ io });
    mod.pushUnreadCounts('u1', 'notifications');
    await settle();
    expect(log.warn).toHaveBeenCalledWith('Unread count emit failed', expect.any(Object));
  });

  it('is a no-op without a Socket.io server (tests, worker processes)', async () => {
    const { mod, Notification, Message } = load({ io: null });
    expect(() => mod.pushUnreadCounts('u1', ['notifications', 'chat'])).not.toThrow();
    await settle();
    expect(Notification.count).not.toHaveBeenCalled();
    expect(Message.count).not.toHaveBeenCalled();
  });

  it('skips the count query when the member has no socket in the room', async () => {
    const { io, emit } = fakeIO(new Map([['user_someone_else', new Set(['s1'])]]));
    const { mod, Notification } = load({ io });
    mod.pushUnreadCounts('u1', 'notifications');
    await settle();
    expect(Notification.count).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('pushes when the member does have a socket in the room', async () => {
    const { io, emit } = fakeIO(new Map([['user_u1', new Set(['s1'])]]));
    const { mod } = load({ io });
    mod.pushUnreadCounts('u1', 'notifications');
    await settle();
    expect(emit).toHaveBeenCalledWith('unread:counts', { notifications: 3 });
  });

  it('ignores unknown kinds and a missing user id', async () => {
    const { io, emit } = fakeIO();
    const { mod } = load({ io });
    mod.pushUnreadCounts('u1', 'bogus');
    mod.pushUnreadCounts(null, 'chat');
    await settle();
    expect(emit).not.toHaveBeenCalled();
  });

  it('timers do not hold the process open', () => {
    const spy = jest.spyOn(global, 'setTimeout');
    const { io } = fakeIO();
    const { mod } = load({ io });
    mod.pushUnreadCounts('u1', 'chat');
    const timer = spy.mock.results[spy.mock.results.length - 1].value;
    expect(timer.hasRef()).toBe(false);
    mod._resetUnreadPushes();
    spy.mockRestore();
  });
});

describe('unreadMessageCount', () => {
  it('excludes blocked members and non-active / staff senders', async () => {
    const { Op } = require('sequelize');
    const { mod, Message } = load({ blocked: ['b1'] });
    await expect(mod.unreadMessageCount('u1')).resolves.toBe(2);
    const { where } = Message.count.mock.calls[0][0];
    expect(where.receiverId).toBe('u1');
    expect(where.isRead).toBe(false);
    expect(where.senderId[Op.notIn]).toEqual(['b1']);
    expect(where.senderId[Op.in]).toBeDefined();
  });

  it('leaves out the notIn clause when nobody is blocked', async () => {
    const { Op } = require('sequelize');
    const { mod, Message } = load({ blocked: [] });
    await mod.unreadMessageCount('u1');
    const { where } = Message.count.mock.calls[0][0];
    expect(where.senderId[Op.notIn]).toBeUndefined();
  });
});
