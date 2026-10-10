/**
 * Admin members, plans and money for launch week: finding a member by what
 * support is actually handed (a phone number typed any way, the TCS- code, the
 * account id), India-time day boundaries, a dashboard that counts paying
 * MEMBERS rather than subscription rows, open work that includes reports under
 * review, the member page's payment details, and the suspension email.
 */

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => ({ success: true })),
  sendAccountStatusEmail: jest.fn(async () => ({ success: true })),
  sendVerificationApproved: jest.fn(async () => ({ success: true })),
  sendVerificationRejected: jest.fn(async () => ({ success: true })),
  sendSupportReply: jest.fn(async () => ({ success: true })),
  sendPartnerWelcome: jest.fn(async () => ({ success: true })),
}));
jest.mock('../../../middlewares/logger', () => {
  const actual = jest.requireActual('../../../middlewares/logger');
  return { ...actual, logAudit: jest.fn() };
});

const { describeDb, makeMember, removeMembers, call, callStream, uniq } = require('../../helpers/db');

const DAY = 86400000;

describeDb('admin members, plans and money', (t) => {
  const ids = [];
  const run = uniq();
  let n = 0;
  let models; let sequelize; let ctl; let email; let admin;

  const phone10 = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const member = async (over = {}, profile = {}) => {
    n += 1;
    const m = await makeMember({ user: { email: `adm-${run}-${n}@example.test`, ...over }, profile });
    ids.push(m.user.id);
    return m.user;
  };
  const setCreatedAt = (id, at) => sequelize.query('UPDATE "Users" SET "createdAt" = :at WHERE id = :id', { replacements: { id, at } });
  const list = async (query, user = admin) => {
    const res = await call(ctl.getUsers, { user, query: { limit: '100', ...query } });
    expect(res.statusCode).toBe(200);
    return res.body.users.map((u) => u.id);
  };
  const stats = async (user = admin) => (await call(ctl.getAnalytics, { user })).body.stats;
  const sub = (userId, over = {}) => models.Subscription.create({
    userId,
    planType: 'premium_plus',
    amount: 1099,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 80 * DAY),
    contactUnlocksAllowed: null,
    razorpayPaymentId: `pay_${uniq()}`,
    razorpayOrderId: `order_${uniq()}`,
    ...over,
  });

  beforeAll(async () => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    ctl = require('../../../controllers/adminController');
    email = require('../../../utils/email');
    admin = await member({ role: 'admin' });
  });

  afterAll(async () => {
    if (!ids.length) return;
    const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
    await q('DELETE FROM "Reports" WHERE "reportedUserId" IN (:ids) OR "reporterId" IN (:ids)');
    await q('DELETE FROM "Appeals" WHERE "userId" IN (:ids)');
    await q('DELETE FROM "AuditLogs" WHERE "targetUserId" IN (:ids) OR "actorId" IN (:ids)');
    await sequelize.query('DELETE FROM "ContactMessages" WHERE email LIKE :pat', { replacements: { pat: `adm-${run}-%` } }).catch(() => {});
    await removeMembers(ids);
  });

  describe('finding a member', () => {
    t('by a phone number typed with +91, spaces or dashes, and by the contact number', async () => {
      const p = phone10();
      const a = await member({ phone: p });
      const contact = phone10();
      const b = await member({ contactPhone: contact });

      expect(await list({ search: `+91 ${p.slice(0, 5)} ${p.slice(5)}` })).toContain(a.id);
      expect(await list({ search: `${p.slice(0, 5)}-${p.slice(5)}` })).toContain(a.id);
      expect(await list({ search: `(+91) ${contact}` })).toContain(b.id);
      // An email still finds its member the plain way.
      expect(await list({ search: a.email })).toEqual([a.id]);
    });

    t('by the TCS- profile code (any case) and by the full account id', async () => {
      const a = await member();
      const code = `TCS-${a.id.split('-')[0].toUpperCase()}`;
      expect(await list({ search: code })).toContain(a.id);
      expect(await list({ search: code.toLowerCase() })).toContain(a.id);
      expect(await list({ search: a.id })).toEqual([a.id]);
      expect(await list({ search: a.id.toUpperCase() })).toEqual([a.id]);
    });
  });

  describe('India-time days', () => {
    t('a member who joined at 00:30 IST on 11 Oct joined on the 11th, not the 10th', async () => {
      const m = await member();
      await setCreatedAt(m.id, '2026-10-10T19:00:00.000Z'); // 00:30 IST on 11 Oct
      expect(await list({ search: m.email, joinedFrom: '2026-10-11', joinedTo: '2026-10-11' })).toEqual([m.id]);
      expect(await list({ search: m.email, joinedFrom: '2026-10-10', joinedTo: '2026-10-10' })).toEqual([]);

      const csv = await callStream(ctl.exportUsers, { user: admin, query: { search: m.email } });
      const [header, row] = csv.body.replace(/^\uFEFF/, '').split('\n').filter(Boolean);
      const joinedCol = header.split(',').indexOf('Joined');
      expect(row.split(',')[joinedCol]).toBe('2026-10-11');
    });

    t('"joined today" starts at midnight in India', async () => {
      const { istTodayStart } = require('../../../utils/istDay');
      const today = await member();
      const lateYesterday = await member();
      await setCreatedAt(lateYesterday.id, new Date(istTodayStart().getTime() - 60 * 1000));
      const found = await list({ search: `adm-${run}-`, joinedWithin: 'today' });
      expect(found).toContain(today.id);
      expect(found).not.toContain(lateYesterday.id);
    });
  });

  describe('plan filters', () => {
    t('"paying" means a real payment; "premium" includes founding and staff grants; erased accounts are in neither', async () => {
      const tag = `adm-${run}-plan`;
      const payer = await member({ email: `${tag}-payer@example.test` });
      const founder = await member({ email: `${tag}-founder@example.test` });
      const granted = await member({ email: `${tag}-granted@example.test` });
      const erased = await member({ email: `${tag}-erased@example.test`, status: 'deleted' });
      await sub(payer.id);
      await sub(founder.id, { planType: 'founding_premium', amount: 0, razorpayPaymentId: null, razorpayOrderId: null, contactUnlocksAllowed: 3 });
      await sub(granted.id, { razorpayPaymentId: null, razorpayOrderId: null });
      await sub(erased.id);

      const sorted = async (plan) => (await list({ search: tag, plan })).sort();
      expect(await sorted('paying')).toEqual([payer.id]);
      expect(await sorted('premium')).toEqual([payer.id, founder.id, granted.id].sort());
      // The old value keeps its old meaning for saved views, minus erased accounts.
      expect(await sorted('paid')).toEqual([payer.id, founder.id, granted.id].sort());
      expect(await sorted('granted')).toEqual([granted.id]);
    });
  });

  describe('dashboard', () => {
    t('counts paying members once each, never staff grants or refunded payments', async () => {
      const before = await stats();
      const granted = await member();
      const twice = await member();
      const refunded = await member();
      await sub(granted.id, { razorpayPaymentId: null, razorpayOrderId: null });
      await sub(twice.id);
      await sub(twice.id);
      await sub(refunded.id, { refundedAt: new Date(), refundedAmount: 1099 });
      const after = await stats();

      expect(after.paidSubscribers - before.paidSubscribers).toBe(1);
      expect(after.staffGrantedActive - before.staffGrantedActive).toBe(1);
      expect(after.activeSubscribers - before.activeSubscribers).toBe(3);
      // Payments taken today: the two real ones; not the grant, not the refunded one.
      expect(after.paymentsToday - before.paymentsToday).toBe(2);

      const noRevenue = await stats({ id: admin.id, role: 'sub_admin', adminPermissions: ['users'] });
      expect(noRevenue.paymentsToday).toBeNull();
    });

    t('open work: reports under review count, urgent ones and appeals are counted, the oldest unread enquiry is dated', async () => {
      const before = await stats();
      const reported = await member();
      const reporter = await member();
      const report = (over) => models.Report.create({ reporterId: reporter.id, reportedUserId: reported.id, reason: 'fake_profile', ...over });
      await report({ status: 'pending', priority: 'urgent' });
      await report({ status: 'reviewing' });
      await report({ status: 'resolved', priority: 'urgent' });
      await models.Appeal.create({ userId: reported.id, email: reported.email, statement: 'please look at this again' });
      const msg = await models.ContactMessage.create({ name: 'Asha', email: `adm-${run}-enquiry@example.test`, message: 'hello', status: 'new' });
      await sequelize.query('UPDATE "ContactMessages" SET "createdAt" = :at WHERE id = :id', { replacements: { at: '1999-01-01T00:00:00.000Z', id: msg.id } });
      const after = await stats();

      expect(after.openReports - before.openReports).toBe(2);
      expect(after.urgentOpenReports - before.urgentOpenReports).toBe(1);
      expect(after.pendingAppeals - before.pendingAppeals).toBe(1);
      expect(new Date(after.oldestUnreadSupportAt).toISOString()).toBe('1999-01-01T00:00:00.000Z');
      expect(after.signupsToday - before.signupsToday).toBe(2);
    });

    t('the no-photo tile counts exactly what its list shows', async () => {
      const before = await stats();
      await member();                                  // counted
      await member({ role: 'admin' });                 // staff: not a member
      await member({ status: 'deleted' });             // erased
      await member({}, { photos: ['https://example.test/p.jpg'] }); // has a photo
      const after = await stats();
      expect(after.profilesWithoutPhoto - before.profilesWithoutPhoto).toBe(1);

      const listed = await call(ctl.getUsers, { user: admin, query: { hasPhoto: 'no', role: 'user', status: 'active', limit: '1' } });
      expect(listed.body.pagination.total).toBe(after.profilesWithoutPhoto);
    });

    t('the signups chart has 30 India days ending today', async () => {
      const { istYmd } = require('../../../utils/istDay');
      const res = await call(ctl.getAnalytics, { user: admin });
      expect(res.body.registrations).toHaveLength(30);
      const today = new Date(`${istYmd()}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      expect(res.body.registrations[29].date).toBe(today);
    });
  });

  describe('member page', () => {
    t('history rows carry the payment date, gateway ids, refunds and disputes', async () => {
      const m = await member();
      const paidAt = new Date(Date.now() - 2 * DAY);
      const s = await sub(m.id, {
        startDate: paidAt,
        refundedAmount: 200,
        refunds: [{ id: 'rfnd_1', amount: 200, at: '2026-10-09T10:00:00.000Z', source: 'admin' }],
        disputeStatus: 'open',
      });
      const res = await call(ctl.getUser, { user: admin, params: { userId: m.id } });
      // As the client receives it: serialised through the models' toJSON.
      const body = JSON.parse(JSON.stringify(res.body));
      const row = body.user.Subscriptions.find((x) => x.id === s.id);
      expect(row.razorpayPaymentId).toBe(s.razorpayPaymentId);
      expect(row.razorpayOrderId).toBe(s.razorpayOrderId);
      expect(new Date(row.paidAt).getTime()).toBe(paidAt.getTime());
      expect(row.paymentRail).toBe('razorpay');
      expect(row.lastRefundAt).toBe('2026-10-09T10:00:00.000Z');
      expect(row.disputeStatus).toBe('open');
      expect(Number(row.refundedAmount)).toBe(200);
    });

    t('received reports carry what was written, for staff who work the report queue', async () => {
      const m = await member();
      const reporter = await member();
      await models.Report.create({ reporterId: reporter.id, reportedUserId: m.id, reason: 'fake_profile', description: 'asked me for money' });

      const full = await call(ctl.getUser, { user: admin, params: { userId: m.id } });
      expect(JSON.parse(JSON.stringify(full.body)).reports[0].description).toBe('asked me for money');

      const usersOnly = { id: admin.id, role: 'sub_admin', adminPermissions: ['users'] };
      const limited = await call(ctl.getUser, { user: usersOnly, params: { userId: m.id } });
      expect(JSON.parse(JSON.stringify(limited.body)).reports[0]).not.toHaveProperty('description');
    });
  });

  describe('moderation history', () => {
    t('a staff action is never pushed out by record views, and views are flagged and counted', async () => {
      const { buildModerationHistory } = require('../../../utils/moderationHistory');
      const m = await member();
      const ban = await models.AuditLog.create({
        action: 'user_status_changed', actorId: admin.id, targetUserId: m.id,
        details: { previousStatus: 'active', newStatus: 'banned', reason: 'fake photos' },
      });
      await sequelize.query('UPDATE "AuditLogs" SET "createdAt" = NOW() - INTERVAL \'1 day\' WHERE id = :id', { replacements: { id: ban.id } });
      await models.AuditLog.bulkCreate(Array.from({ length: 105 }, () => ({ action: 'member_record_viewed', actorId: admin.id, targetUserId: m.id, details: {} })));

      const history = await buildModerationHistory(m.id);
      const action = history.timeline.find((e) => e.summary === 'user_status_changed');
      expect(action).toBeTruthy();
      expect(action.details).toMatchObject({ previousStatus: 'active', newStatus: 'banned', reason: 'fake photos' });
      expect(action.view).toBeUndefined();
      expect(history.summary.views).toBe(105);
      expect(history.timeline.filter((e) => e.view)).toHaveLength(100);
    });
  });

  describe('suspension email', () => {
    const setStatus = (target, status, reason) => call(ctl.updateUserStatus, { user: admin, params: { userId: target.id }, body: { status, reason } });

    t('a verified member is emailed the reason and the appeal link, and again when restored', async () => {
      const m = await member({ emailVerified: true }, { firstName: 'Asha' });
      const res = await setStatus(m, 'banned', 'Photos are not of you');
      expect(res.statusCode).toBe(200);
      expect(res.body.memberEmailed).toBe(true);
      expect(res.body.memberEmail).toBe('sent');
      expect(email.sendAccountStatusEmail).toHaveBeenCalledWith(m.email, 'Asha', true, 'Photos are not of you');

      email.sendAccountStatusEmail.mockClear();
      const back = await setStatus(m, 'active', '');
      expect(back.body.memberEmailed).toBe(true);
      expect(email.sendAccountStatusEmail).toHaveBeenCalledWith(m.email, 'Asha', false, null);
    });

    t('an unverified address is not emailed', async () => {
      const m = await member({ emailVerified: false });
      const res = await setStatus(m, 'banned', 'Spam messages');
      expect(res.statusCode).toBe(200);
      expect(res.body.memberEmailed).toBe(false);
      expect(res.body.memberEmail).toBe('no_verified_email');
      expect(email.sendAccountStatusEmail).not.toHaveBeenCalled();
      await m.reload();
      expect(m.status).toBe('banned');
    });

    t('a mail failure still bans the member', async () => {
      const m = await member({ emailVerified: true });
      email.sendAccountStatusEmail.mockRejectedValueOnce(new Error('mail service down'));
      const res = await setStatus(m, 'banned', 'Harassment reports');
      expect(res.statusCode).toBe(200);
      expect(res.body.memberEmailed).toBe(false);
      expect(res.body.memberEmail).toBe('failed');
      await m.reload();
      expect(m.status).toBe('banned');
    });
  });
});
