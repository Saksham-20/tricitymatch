/**
 * The unread badges are pushed over the socket now (utils/unreadCounts), and
 * the REST endpoints shipped mobile builds still poll must report the very same
 * numbers. Real database: the counting rules (staff, banned, blocked senders)
 * are SQL, and a mocked count would only test the mock.
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendMessageNotification: jest.fn(async () => true),
}));
jest.mock('../../../utils/emailService', () => ({
  sendMessageNotification: jest.fn(async () => true),
  sendMatchNotification: jest.fn(async () => true),
}));
jest.mock('../../../utils/fcm', () => ({ sendPushNotification: jest.fn(async () => ({ failedTokens: [] })) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('unread counts: REST and socket push agree', (t) => {
  const ids = [];
  let models; let chat; let notifications; let unread; let socket;
  const emitted = [];
  const fakeIO = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };

  beforeAll(() => {
    models = require('../../../models');
    chat = require('../../../controllers/chatController');
    notifications = require('../../../controllers/notificationController');
    unread = require('../../../utils/unreadCounts');
    socket = require('../../../utils/socket');
  });

  beforeEach(() => { emitted.length = 0; });

  afterAll(async () => {
    socket.setIO(null);
    unread._resetUnreadPushes();
    const sequelize = require('../../../config/database');
    if (ids.length) {
      await sequelize.query('DELETE FROM "Messages" WHERE "senderId" IN (:ids) OR "receiverId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });

  const member = async (o = {}) => {
    const m = await makeMember({ user: o.user, profile: { gender: o.gender || 'female', ...(o.profile || {}) } });
    ids.push(m.user.id);
    return m.user;
  };
  const mutual = async (a, b) => {
    await models.Match.create({ userId: a.id, matchedUserId: b.id, action: 'like', isMutual: true, mutualMatchDate: new Date() });
    await models.Match.create({ userId: b.id, matchedUserId: a.id, action: 'like', isMutual: true, mutualMatchDate: new Date() });
  };
  // The push is trailing (~300 ms) and async; wait for the event, not a guess.
  const pushedTo = async (userId, key) => {
    const deadline = Date.now() + 4000;
    for (;;) {
      const hit = emitted.find((e) => e.room === `user_${userId}` && e.event === 'unread:counts' && key in e.payload);
      if (hit) return hit.payload;
      if (Date.now() > deadline) throw new Error(`no unread:counts push with "${key}" for ${userId}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  t('the REST endpoints return exactly what the shared functions compute', async () => {
    socket.setIO(null);
    const me = await member();
    const real = await member({ gender: 'male' });
    const staff = await member({ user: { role: 'marketing' }, profile: { gender: 'other' } });
    const banned = await member({ gender: 'male', user: { status: 'banned' } });
    const blocker = await member({ gender: 'male' });
    for (const other of [real, staff, banned, blocker]) {
      await models.Message.create({ senderId: other.id, receiverId: me.id, content: 'hi' });
    }
    await models.Block.create({ blockerId: me.id, blockedUserId: blocker.id });
    await models.Notification.bulkCreate([
      { userId: me.id, type: 'system', title: 'a', body: 'a', isRead: false },
      { userId: me.id, type: 'system', title: 'b', body: 'b', isRead: false },
      { userId: me.id, type: 'system', title: 'c', body: 'c', isRead: true },
    ]);

    const chatRest = await call(chat.getUnreadMessageCount, { user: me });
    expect(chatRest.body.count).toBe(1); // only the active, unblocked member
    expect(await unread.unreadMessageCount(me.id)).toBe(chatRest.body.count);

    const notifRest = await call(notifications.getUnreadCount, { user: me });
    expect(notifRest.body.count).toBe(2);
    expect(await unread.unreadNotificationCount(me.id)).toBe(notifRest.body.count);

    const list = await call(notifications.getNotifications, { user: me, query: {} });
    expect(list.body.unreadCount).toBe(2);
  });

  t('a new notification, mark-read, read-all and delete push the bell count', async () => {
    socket.setIO(fakeIO);
    const { notify } = require('../../../utils/notifyUser');
    const me = await member();

    const n1 = await notify(me.id, 'system', 'One', 'body');
    await notify(me.id, 'system', 'Two', 'body');
    expect((await pushedTo(me.id, 'notifications')).notifications).toBe(2);
    // The two notifications were one burst: one push, not two.
    expect(emitted.filter((e) => e.room === `user_${me.id}` && e.event === 'unread:counts').length).toBe(1);

    emitted.length = 0;
    await call(notifications.markRead, { user: me, params: { id: n1.id } });
    expect((await pushedTo(me.id, 'notifications')).notifications).toBe(1);

    emitted.length = 0;
    await call(notifications.markAllRead, { user: me });
    expect((await pushedTo(me.id, 'notifications')).notifications).toBe(0);

    emitted.length = 0;
    const n3 = await notify(me.id, 'system', 'Three', 'body');
    expect((await pushedTo(me.id, 'notifications')).notifications).toBe(1);
    emitted.length = 0;
    await call(notifications.deleteNotification, { user: me, params: { id: n3.id } });
    expect((await pushedTo(me.id, 'notifications')).notifications).toBe(0);
  });

  t('a chat message pushes the receiver\'s count; reading the thread pushes the reader\'s', async () => {
    socket.setIO(fakeIO);
    const me = await member();
    const them = await member({ gender: 'male' });
    await mutual(me, them);

    const sent = await call(chat.sendMessage, { user: them, body: { receiverId: me.id, content: 'hello' } });
    expect(sent.statusCode).toBe(200);
    expect(await pushedTo(me.id, 'chat')).toEqual({ chat: 1 });
    expect(emitted.find((e) => e.room === `user_${them.id}`)).toBeUndefined();

    emitted.length = 0;
    const read = await call(chat.getMessages, { user: me, params: { userId: them.id }, query: {} });
    expect(read.statusCode).toBe(200);
    expect(await pushedTo(me.id, 'chat')).toEqual({ chat: 0 });

    // Re-opening a thread with nothing new to read sends nothing.
    emitted.length = 0;
    await call(chat.getMessages, { user: me, params: { userId: them.id }, query: {} });
    await new Promise((r) => setTimeout(r, 500));
    expect(emitted).toEqual([]);

    // The sender deletes an unread message: the receiver's badge drops.
    const again = await call(chat.sendMessage, { user: them, body: { receiverId: me.id, content: 'oops' } });
    expect(await pushedTo(me.id, 'chat')).toEqual({ chat: 1 });
    emitted.length = 0;
    await call(chat.deleteMessage, { user: them, params: { messageId: again.body.message.id } });
    expect(await pushedTo(me.id, 'chat')).toEqual({ chat: 0 });
  });
});
