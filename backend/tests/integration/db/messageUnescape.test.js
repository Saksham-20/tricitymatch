/**
 * Migration 000082 un-escapes existing message rows; new messages round-trip raw.
 */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('message text round trip', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  t('a message with & < > " \' is stored and returned exactly as typed', async () => {
    const { Match, Message } = require('../../../models');
    const chat = require('../../../controllers/chatController');
    const a = await makeMember(); const b = await makeMember(); ids.push(a.user.id, b.user.id);
    await Match.create({ userId: a.user.id, matchedUserId: b.user.id, action: 'like', isMutual: true });
    await Match.create({ userId: b.user.id, matchedUserId: a.user.id, action: 'like', isMutual: true });
    const text = `Tom & Jerry's "plan": 5 > 3, I <3 you`;
    const sent = await call(chat.sendMessage, { user: { id: a.user.id, role: 'user' }, body: { receiverId: b.user.id, content: text } });
    expect(sent.statusCode).toBeLessThan(300);
    await new Promise((r) => setTimeout(r, 100));
    const row = await Message.findOne({ where: { senderId: a.user.id, receiverId: b.user.id } });
    expect(row.content).toBe(text);
  });

  t('the migration SQL turns stored entities back into text, ampersand last', async () => {
    const sequelize = require('../../../config/database');
    const mig = require('../../../migrations/20240101000082-unescape-message-text');
    const { Message } = require('../../../models');
    const a = await makeMember(); const b = await makeMember(); ids.push(a.user.id, b.user.id);
    const mk = (content) => Message.create({ senderId: a.user.id, receiverId: b.user.id, content });
    const m1 = await mk('Tom &amp; Jerry&#x27;s &quot;plan&quot; 5 &gt; 3');
    const m2 = await mk('typed literally: &amp;lt;'); // member typed "&lt;"
    const m3 = await mk('plain text stays');
    await mig.up({ sequelize });
    expect((await Message.findByPk(m1.id)).content).toBe(`Tom & Jerry's "plan" 5 > 3`);
    expect((await Message.findByPk(m2.id)).content).toBe('typed literally: &lt;');
    expect((await Message.findByPk(m3.id)).content).toBe('plain text stays');
  });
});
