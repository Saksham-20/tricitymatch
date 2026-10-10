/**
 * Admin queues on a busy day: the support inbox (oldest first, "not replied",
 * the member account behind an enquiry), the audit log for members with no
 * email, the report queue's repeat-report count, evidence listed per report,
 * the original suspension reason beside an appeal, and photo-review history.
 */
jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../middlewares/logger', () => {
  const actual = jest.requireActual('../../../middlewares/logger');
  return { ...actual, logAudit: jest.fn() };
});

const { describeDb, makeMember, removeMembers, call, callStream, uniq } = require('../../helpers/db');

const DAY = 86400000;
const mobile = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
const spaced = (phone) => `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
// What the browser receives (custom fields ride on dataValues).
const plain = (v) => JSON.parse(JSON.stringify(v));

describeDb('admin queues', (t) => {
  const ids = [];
  const actions = [];
  const enquiryTag = `enq-${uniq()}`;
  let models; let sequelize; let adminCtl; let analyticsCtl; let appealCtl; let admin;

  const member = async (user = {}, profile = {}) => {
    const m = await makeMember({ user, profile });
    ids.push(m.user.id);
    return m.user;
  };

  beforeAll(async () => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    adminCtl = require('../../../controllers/adminController');
    analyticsCtl = require('../../../controllers/analyticsController');
    appealCtl = require('../../../controllers/appealController');
    admin = await member({ role: 'admin' });
  });

  afterAll(async () => {
    const q = (sql, replacements) => sequelize.query(sql, { replacements }).catch(() => {});
    await q('DELETE FROM "ContactMessages" WHERE subject = :tag', { tag: enquiryTag });
    for (const a of actions) await q('DELETE FROM "AuditLogs" WHERE action = :a', { a });
    if (ids.length) {
      await q('DELETE FROM "EvidenceArchives" WHERE "subjectUserId" IN (:ids)', { ids });
      await q('DELETE FROM "Appeals" WHERE "userId" IN (:ids)', { ids });
      await q('DELETE FROM "MediaReviews" WHERE "userId" IN (:ids)', { ids });
      await q('DELETE FROM "AuditLogs" WHERE "targetUserId" IN (:ids) OR "actorId" IN (:ids)', { ids });
      await q('DELETE FROM "Reports" WHERE "reporterId" IN (:ids) OR "reportedUserId" IN (:ids)', { ids });
      await removeMembers(ids);
    }
  });

  describe('support inbox', () => {
    const enquiry = (over = {}) => models.ContactMessage.create({
      name: 'Asha', email: `writer-${uniq()}@example.test`, subject: enquiryTag, message: 'I need help with my account', ...over,
    });
    const inbox = async (query) => plain((await call(adminCtl.getContactMessages, { user: admin, query: { search: enquiryTag, ...query } })).body);

    t('lists oldest first on request, and "not replied" leaves answered enquiries out', async () => {
      const old = await enquiry({ createdAt: new Date(Date.now() - 3 * DAY) });
      const answered = await enquiry({ createdAt: new Date(Date.now() - 2 * DAY), replyBody: 'Sorted, thank you', repliedAt: new Date(), status: 'resolved' });
      const recent = await enquiry({ createdAt: new Date(Date.now() - DAY) });

      expect((await inbox({})).messages.map((m) => m.id)).toEqual([recent.id, answered.id, old.id]);
      expect((await inbox({ sort: 'oldest' })).messages.map((m) => m.id)).toEqual([old.id, answered.id, recent.id]);
      expect((await inbox({ sort: 'oldest', replied: 'no' })).messages.map((m) => m.id)).toEqual([old.id, recent.id]);
      expect((await inbox({ replied: 'yes' })).messages.map((m) => m.id)).toEqual([answered.id]);
    });

    t('links an enquiry to the member with the same email (any case) or mobile number, never to staff', async () => {
      const byEmail = await member({ email: `asha-${uniq()}@example.test` });
      const phone = mobile();
      const byPhone = await member({ email: null, phone });
      const staff = await member({ role: 'admin', email: `staff-${uniq()}@example.test` });

      const viaEmail = await enquiry({ email: byEmail.email.toUpperCase() });
      const viaPhone = await enquiry({ email: `stranger-${uniq()}@example.test`, phone: spaced(phone) });
      const fromStaff = await enquiry({ email: staff.email });
      const nobody = await enquiry({ email: `nobody-${uniq()}@example.test`, phone: '12345' });

      const { messages } = await inbox({});
      const of = (e) => messages.find((m) => m.id === e.id);
      expect(of(viaEmail)).toMatchObject({ memberId: byEmail.id, memberMatch: 'email' });
      expect(of(viaPhone)).toMatchObject({ memberId: byPhone.id, memberMatch: 'phone' });
      expect(of(fromStaff).memberId).toBeNull();
      expect(of(nobody).memberId).toBeNull();
    });
  });

  describe('audit log', () => {
    const actionTag = () => { const a = `test_audit_${uniq()}`; actions.push(a); return a; };
    const log = async (query) => (await call(analyticsCtl.getAuditLog, { user: admin, query })).body;

    t('finds a member with no email by phone digits or by name, and names them', async () => {
      const action = actionTag();
      const phone = mobile();
      const first = `Zorawar${uniq()}`;
      const phoneOnly = await member({ email: null, phone }, { firstName: first, lastName: 'Gill' });
      const other = await member();
      await models.AuditLog.create({ action, actorId: admin.id, targetUserId: phoneOnly.id, details: { n: 1 } });
      await models.AuditLog.create({ action, actorId: admin.id, targetUserId: other.id, details: { n: 2 } });

      const typed = await log({ action, target: spaced(phone) });
      expect(typed.entries.map((e) => e.details.n)).toEqual([1]);
      expect((await log({ action, target: phone })).entries.map((e) => e.details.n)).toEqual([1]);
      expect((await log({ action, target: `${first.toLowerCase()} gill` })).entries.map((e) => e.details.n)).toEqual([1]);
      // Email still works, for "who did it" as much as "who was it about".
      expect((await log({ action, actor: admin.email })).pagination.total).toBe(2);

      const about = plain(typed.entries[0]).TargetUser;
      expect(about).toMatchObject({ id: phoneOnly.id, email: null, phone, Profile: { firstName: first, lastName: 'Gill' } });

      const csv = await callStream(analyticsCtl.getAuditLog, { user: admin, query: { action, target: phone, format: 'csv' } });
      const rows = csv.body.replace(/^\uFEFF/, '').split('\n').filter(Boolean);
      expect(rows).toHaveLength(2);
      expect(rows[1]).toContain(`${first} Gill · ${phone}`);
    });

    t('a few stray digits are not treated as a phone number', async () => {
      const action = actionTag();
      const someone = await member({ email: null, phone: mobile() });
      await models.AuditLog.create({ action, targetUserId: someone.id, details: { n: 1 } });
      expect((await log({ action, target: someone.phone.slice(-4) })).pagination.total).toBe(0);
    });
  });

  t('each report says how many other reports the member has, and whether they are hidden', async () => {
    const name = `Repeat${uniq()}`;
    const subject = await member({ hiddenAt: new Date(), hiddenReason: 'details being checked' }, { firstName: name });
    const file = async (over = {}) => models.Report.create({ reporterId: (await member()).id, reportedUserId: subject.id, reason: 'spam', ...over });
    const waiting = await file();
    await file({ status: 'dismissed' });
    const underReview = await file({ status: 'reviewing' });

    const res = await call(adminCtl.getReports, { user: admin, query: { status: 'pending', search: name } });
    const rows = plain(res.body.reports);
    expect(rows.map((r) => r.id)).toEqual([waiting.id]);
    expect(rows[0]).toMatchObject({ otherReports: 2, otherOpenReports: 1 });
    expect(rows[0].ReportedUser).toMatchObject({ id: subject.id, invisible: true, status: 'active', role: 'user' });
    expect(rows[0].ReportedUser).not.toHaveProperty('hiddenAt');

    // "Open" is everything still waiting on a decision, the set the dashboard counts.
    const open = plain((await call(adminCtl.getReports, { user: admin, query: { status: 'open', search: name } })).body.reports);
    expect(open.map((r) => r.id).sort()).toEqual([waiting.id, underReview.id].sort());
  });

  t('evidence is listed for one report, says what each record holds, and refuses a malformed id', async () => {
    const subject = await member();
    const report = await models.Report.create({ reporterId: (await member()).id, reportedUserId: subject.id, reason: 'harassment' });
    const another = await models.Report.create({ reporterId: (await member()).id, reportedUserId: subject.id, reason: 'spam' });
    const keep = (over) => models.EvidenceArchive.create({ subjectUserId: subject.id, preserveUntil: new Date(Date.now() + DAY), ...over });
    const snapshot = await keep({ reportId: report.id, reason: 'harassment', payload: { source: 'report_filed', messages: [{ id: 'm1', content: 'a' }, { id: 'm2', content: 'b' }] } });
    const deleted = await keep({ reportId: report.id, reason: 'message_deleted_during_report', payload: { source: 'message_deleted', message: { id: 'm3', content: 'c' } } });
    await keep({ reportId: another.id, reason: 'spam', payload: { source: 'report_filed', messages: [{ id: 'm4', content: 'd' }] } });

    const forReport = plain((await call(appealCtl.listEvidence, { user: admin, query: { reportId: report.id } })).body.evidence);
    expect(forReport.map((r) => r.id).sort()).toEqual([snapshot.id, deleted.id].sort());
    expect(forReport.find((r) => r.id === snapshot.id)).toMatchObject({ source: 'report_filed', messageCount: 2 });
    expect(forReport.find((r) => r.id === deleted.id)).toMatchObject({ source: 'message_deleted', messageCount: 1 });
    expect(forReport[0]).not.toHaveProperty('payload');

    expect((await call(appealCtl.listEvidence, { user: admin, query: { userId: subject.id } })).body.evidence).toHaveLength(3);
    expect((await call(appealCtl.listEvidence, { user: admin, query: { reportId: 'not-an-id' } })).statusCode).toBe(400);
  });

  t('an appeal carries the reason the member was suspended for', async () => {
    const banned = await member({ status: 'banned' });
    const bulkBanned = await member({ status: 'banned' });
    const before = new Date(Date.now() - 10 * DAY);
    await models.AuditLog.create({
      action: 'user_status_changed', actorId: admin.id, targetUserId: banned.id, createdAt: before,
      details: { targetUserId: banned.id, previousStatus: 'active', newStatus: 'banned', reason: 'Asked members for money' },
    });
    await models.AuditLog.create({
      action: 'users_bulk_status_changed', actorId: admin.id, createdAt: before,
      details: { status: 'banned', count: 1, ids: [bulkBanned.id] },
    });
    const statement = 'Please look at my account again, I think this was a mistake.';
    const one = await models.Appeal.create({ userId: banned.id, email: banned.email, statement });
    const two = await models.Appeal.create({ userId: bulkBanned.id, email: bulkBanned.email, statement });
    // A suspension after the appeal was sent is a separate matter.
    await models.AuditLog.create({
      action: 'user_status_changed', actorId: admin.id, targetUserId: banned.id, createdAt: new Date(Date.now() + 60000),
      details: { targetUserId: banned.id, newStatus: 'banned', reason: 'Something later' },
    });

    const rows = plain((await call(appealCtl.listAppeals, { user: admin, query: { status: 'pending' } })).body.appeals);
    const first = rows.find((r) => r.id === one.id);
    expect(first.suspension).toMatchObject({ status: 'banned', reason: 'Asked members for money', byEmail: admin.email, bulk: false });
    expect(first.User).toMatchObject({ id: banned.id, Profile: { firstName: 'It' } });
    expect(rows.find((r) => r.id === two.id).suspension).toMatchObject({ status: 'banned', reason: null, bulk: true });
  });

  t('a decision on an appeal sent with only a mobile number is not emailed', async () => {
    const { sendEmail } = require('../../../utils/email');
    const statement = 'Please look at my account again, I did not break any rule.';
    const decide = (appeal, decision, note) => call(appealCtl.decideAppeal, { user: admin, params: { id: appeal.id }, body: { decision, note } });

    const byPhone = await member({ email: null, phone: mobile(), status: 'banned' });
    const phoneAppeal = await models.Appeal.create({ userId: byPhone.id, email: `+91${byPhone.phone}`, statement });
    sendEmail.mockClear();
    expect((await decide(phoneAppeal, 'overturned', 'Checked the chats, restoring the account.')).body).toMatchObject({ success: true, emailed: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect((await models.User.findByPk(byPhone.id)).status).toBe('active');

    const byEmail = await member({ status: 'banned' });
    const emailAppeal = await models.Appeal.create({ userId: byEmail.id, email: byEmail.email, statement });
    expect((await decide(emailAppeal, 'upheld', 'The messages break the rules, the ban stays.')).body).toMatchObject({ success: true, emailed: true });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: byEmail.email }));
  });

  t('decided photos list the newest decision first', async () => {
    const { listMediaReviews } = require('../../../controllers/mediaReviewController');
    const owner = await member();
    const decided = (when) => models.MediaReview.create({
      userId: owner.id, url: `https://res.cloudinary.com/x/${uniq()}.jpg`, source: 'admin', status: 'rejected', decidedAt: when,
    });
    const older = await decided(new Date(Date.now() - DAY));
    const newer = await decided(new Date());
    const res = await call(listMediaReviews, { user: admin, query: { status: 'rejected', source: 'admin' } });
    expect(res.body.reviews.filter((r) => r.userId === owner.id).map((r) => r.id)).toEqual([newer.id, older.id]);
  });
});
