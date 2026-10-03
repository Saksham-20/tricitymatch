/**
 * Evidence for a report is captured when the report is filed, and a message that
 * is deleted or edited while a report is open is archived first.
 */
jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('report evidence', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      await sequelize.query('DELETE FROM "EvidenceArchives" WHERE "subjectUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
      await sequelize.query('DELETE FROM "Reports" WHERE "reporterId" IN (:ids) OR "reportedUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });
  const member = async () => { const m = await makeMember(); ids.push(m.user.id); return m.user; };
  const models = () => require('../../../models');
  const send = async (from, to, content) => models().Message.create({ senderId: from.id, receiverId: to.id, content });
  const fileReport = (from, to, body = { reason: 'harassment' }) => call(require('../../../controllers/blockReportController').reportUser, { user: from, params: { userId: to.id }, body });
  const del = (user, m) => call(require('../../../controllers/chatController').deleteMessage, { user: { id: user.id, role: 'user' }, params: { messageId: m.id } });
  const edit = (user, m, content) => call(require('../../../controllers/chatController').editMessage, { user: { id: user.id, role: 'user' }, params: { messageId: m.id }, body: { content } });
  const archives = (subject) => models().EvidenceArchive.findAll({ where: { subjectUserId: subject.id }, order: [['createdAt', 'ASC']] });

  t('filing a report archives the recent conversation, both sides, for staff', async () => {
    const reporter = await member(); const abuser = await member();
    await send(abuser, reporter, 'you will regret this');
    await send(reporter, abuser, 'stop messaging me');
    const res = await fileReport(reporter, abuser);
    expect(res.statusCode).toBe(201);
    const rows = await archives(abuser);
    expect(rows).toHaveLength(1);
    expect(rows[0].reportId).toBe(res.body.reportId);
    expect(rows[0].payload.source).toBe('report_filed');
    expect(rows[0].payload.messages.map((m) => m.content)).toEqual(['you will regret this', 'stop messaging me']);
    const days = (rows[0].preserveUntil - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(170);
  });

  t('the reported member deleting a message after the report cannot remove it from the record', async () => {
    const reporter = await member(); const abuser = await member();
    const bad = await send(abuser, reporter, 'threatening message');
    await fileReport(reporter, abuser);
    expect((await del(abuser, bad)).statusCode).toBe(200);
    expect(await models().Message.findByPk(bad.id)).toBeNull(); // really deleted for the chat
    const rows = await archives(abuser);
    const kept = rows.find((r) => r.reason === 'message_deleted_during_report');
    expect(kept).toBeDefined();
    expect(kept.payload.message.content).toBe('threatening message');
    // the snapshot taken when the report was filed already had it too
    expect(rows.find((r) => r.payload.source === 'report_filed').payload.messages.map((m) => m.content)).toContain('threatening message');
  });

  t('editing a message while a report is open archives what it said before', async () => {
    const reporter = await member(); const abuser = await member();
    const m = await send(abuser, reporter, 'original wording');
    await fileReport(reporter, abuser);
    expect((await edit(abuser, m, 'innocent wording')).statusCode).toBe(200);
    const kept = (await archives(abuser)).find((r) => r.reason === 'message_edited_during_report');
    expect(kept).toBeDefined();
    expect(kept.payload.message.content).toBe('original wording');
  });

  t('with NO open report, deleting still really deletes and keeps nothing', async () => {
    const a = await member(); const b = await member();
    const m = await send(a, b, 'ordinary message');
    expect((await del(a, m)).statusCode).toBe(200);
    expect(await archives(a)).toHaveLength(0);
  });

  t('a report with no conversation stores no empty archive', async () => {
    const a = await member(); const b = await member();
    expect((await fileReport(a, b, { reason: 'spam' })).statusCode).toBe(201);
    expect(await archives(b)).toHaveLength(0);
  });
});
