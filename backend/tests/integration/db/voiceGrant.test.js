/**
 * CHAT-13: a voice note from a paid member to a free one must open the same
 * free-reply window a text message does. Without the grant the free recipient
 * could not open the conversation at all, so never even heard the note.
 */
process.env.FREE_REPLY_WINDOW = 'true';
process.env.FREE_CHAT_FOR_MUTUALS = 'false';

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
const mockMail = jest.fn(async () => true);
jest.mock('../../../utils/emailService', () => ({
  sendMatchNotification: jest.fn(async () => true),
  sendMessageNotification: (...a) => mockMail(...a),
}));

const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const callVoice = (user, body) => new Promise((resolve) => {
  const res = {
    statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; resolve(res); return this; },
  };
  require('../../../controllers/chatController').sendVoiceMessage(
    { user, body, file: { path: 'https://example.test/voice.webm' }, app: { get: () => null }, headers: {}, ip: '127.0.0.1' },
    res,
    (err) => { res.statusCode = (err && err.statusCode) || 500; res.body = { error: err }; resolve(res); }
  );
});

describeDb('voice message reply window', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  const setup = async () => {
    const { Match, Subscription } = require('../../../models');
    const paid = await makeMember({ profile: { gender: 'male' } });
    const free = await makeMember({ profile: { gender: 'female' } });
    ids.push(paid.user.id, free.user.id);
    await Subscription.create({
      userId: paid.user.id, planType: 'premium_plus', status: 'active', amount: 109900,
      startDate: new Date(), endDate: new Date(Date.now() + 86400000),
    });
    await Match.create({ userId: paid.user.id, matchedUserId: free.user.id, action: 'like', isMutual: true });
    await Match.create({ userId: free.user.id, matchedUserId: paid.user.id, action: 'like', isMutual: true });
    return { paid: paid.user, free: free.user };
  };

  t('a voice note to a free member creates the grant and emails them', async () => {
    const { ChatGrant, Message } = require('../../../models');
    const { paid, free } = await setup();
    const res = await callVoice(paid, { receiverId: free.id, durationMs: '4000' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await Message.count({ where: { senderId: paid.id, receiverId: free.id, messageType: 'voice' } })).toBe(1);
    const grant = await ChatGrant.findOne({ where: { premiumUserId: paid.id, freeUserId: free.id } });
    expect(grant).not.toBeNull();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(mockMail).toHaveBeenCalledTimes(1);
    expect(mockMail.mock.calls[0][0]).toBe(free.email);
  });

  t('sending a second voice note does not duplicate the grant', async () => {
    const { ChatGrant } = require('../../../models');
    const { paid, free } = await setup();
    await callVoice(paid, { receiverId: free.id });
    await callVoice(paid, { receiverId: free.id });
    expect(await ChatGrant.count({ where: { premiumUserId: paid.id, freeUserId: free.id } })).toBe(1);
  });
});
