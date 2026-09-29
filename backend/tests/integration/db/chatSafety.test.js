/**
 * Chat scam/phishing signals through the real send and edit paths (audit P2).
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendMessageNotification: jest.fn(async () => true),
}));
jest.mock('../../../utils/emailService', () => ({
  sendMessageNotification: jest.fn(async () => true),
}));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('chat safety flags', (t) => {
  const ids = [];
  let models; let email; let chat;
  beforeAll(() => {
    models = require('../../../models');
    email = require('../../../utils/email');
    chat = require('../../../controllers/chatController');
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "Messages" WHERE "senderId" IN (:ids) OR "receiverId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  const member = async () => { const m = await makeMember(); ids.push(m.user.id); return m.user; };
  const mutual = async (a, b) => {
    await models.Match.create({ userId: a.id, matchedUserId: b.id, action: 'like', isMutual: true });
    await models.Match.create({ userId: b.id, matchedUserId: a.id, action: 'like', isMutual: true });
  };
  const send = (from, to, content) => call(chat.sendMessage, { user: { id: from.id, role: 'user' }, body: { receiverId: to.id, content } });
  const flush = () => new Promise((r) => setTimeout(r, 120));

  t('an ordinary message carries no flags', async () => {
    const a = await member(); const b = await member(); await mutual(a, b);
    const res = await send(a, b, 'Hello, lovely to meet you');
    expect(res.statusCode).toBe(200);
    expect(res.body.safety).toBeUndefined();
    expect((await models.Message.findByPk(res.body.message.id)).safetyFlags).toBeNull();
  });

  t('a flagged message is still delivered, stored with its flags, and the sender is told', async () => {
    const a = await member(); const b = await member(); await mutual(a, b);
    const res = await send(a, b, 'pay to asha@okhdfcbank and see bit.ly/abc');
    expect(res.statusCode).toBe(200);
    expect(res.body.safety.high).toBe(true);
    expect(res.body.safety.flags).toEqual(expect.arrayContaining(['upi_id', 'suspicious_link']));
    const row = await models.Message.findByPk(res.body.message.id);
    expect(row.safetyFlags).toEqual(expect.arrayContaining(['upi_id', 'suspicious_link']));
    expect(row.content).toContain('okhdfcbank'); // delivered, not blocked or altered
  });

  t('editing a harmless message into a scam message adds the flags', async () => {
    const a = await member(); const b = await member(); await mutual(a, b);
    const sent = await send(a, b, 'good morning');
    const id = sent.body.message.id;
    const edited = await call(chat.editMessage, { user: { id: a.id, role: 'user' }, params: { messageId: id }, body: { content: 'please send me money now' } });
    expect(edited.statusCode).toBe(200);
    expect((await models.Message.findByPk(id)).safetyFlags).toContain('payment_request');
    // and back again clears them
    await call(chat.editMessage, { user: { id: a.id, role: 'user' }, params: { messageId: id }, body: { content: 'sorry, wrong chat' } });
    expect((await models.Message.findByPk(id)).safetyFlags).toBeNull();
  });

  t('repeated strong signals to different members alert staff once', async () => {
    const scammer = await member();
    const victims = [await member(), await member(), await member()];
    for (const v of victims) await mutual(scammer, v);

    await send(scammer, victims[0], 'send me money please');
    await send(scammer, victims[0], 'pay to asha@okaxis');
    await flush();
    expect(email.sendEmail).not.toHaveBeenCalled(); // one recipient so far

    await send(scammer, victims[1], 'gift card please');
    await flush();
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(email.sendEmail.mock.calls[0][0].subject).toMatch(/Chat safety/);
    expect(email.sendEmail.mock.calls[0][0].text).toContain(scammer.id);

    await send(scammer, victims[2], 'transfer the amount now');
    await flush();
    expect(email.sendEmail).toHaveBeenCalledTimes(1); // once per window
  });

  t('weak signals alone never alert staff', async () => {
    const a = await member(); const b = await member(); const c = await member();
    await mutual(a, b); await mutual(a, c);
    for (let i = 0; i < 8; i += 1) await send(a, i % 2 ? b : c, `see https://drive.google.com/file/${i}`);
    await flush();
    expect(email.sendEmail).not.toHaveBeenCalled();
  });
});
