/**
 * Admin operations: moving leads between partners, the marketing manager's team
 * view, and the audit log (filters, export, de-duplicated read rows).
 */

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/email', () => ({
  ...jest.requireActual('../../../utils/email'),
  sendEmail: jest.fn(async () => ({ success: true })),
  sendPartnerWelcome: jest.fn(async () => ({ success: true })),
}));
jest.mock('../../../middlewares/logger', () => {
  const actual = jest.requireActual('../../../middlewares/logger');
  return { ...actual, logAudit: jest.fn() };
});

const { describeDb, makeMember, removeMembers, call, callStream, uniq } = require('../../helpers/db');

const DAY = 86400000;

describeDb('admin operations', (t) => {
  const ids = [];
  const tags = [];
  let models; let sequelize; let admin; let adminCtl; let analyticsCtl; let teamCtl; let reassign; let manualLeads; let commission; let audit;

  const user = async (over = {}, profile = {}) => { const m = await makeMember({ user: over, profile }); ids.push(m.user.id); return m.user; };
  const partner = (over = {}) => user({ role: 'marketing', ...over });
  const lead = (rep, over = {}) => models.MarketingLead.create({
    name: 'Lead', phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, email: 'N/A',
    assignedToMarketingUserId: rep.id, status: 'new', source: 'manual', ...over,
  });
  const sub = (userId, over = {}) => models.Subscription.create({
    userId, planType: 'premium_plus', amount: 1000, status: 'active',
    startDate: new Date(Date.now() - 10 * DAY), endDate: new Date(Date.now() + 80 * DAY),
    contactUnlocksAllowed: null, razorpayPaymentId: `pay_${uniq()}`, razorpayOrderId: `order_${uniq()}`, ...over,
  });

  beforeAll(async () => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    adminCtl = require('../../../controllers/adminController');
    analyticsCtl = require('../../../controllers/analyticsController');
    teamCtl = require('../../../controllers/marketingTeamController');
    reassign = require('../../../utils/leadReassignment');
    manualLeads = require('../../../utils/manualLeads');
    commission = require('../../../utils/marketingCommission');
    audit = require('../../../middlewares/logger').logAudit;
    commission.__setCacheForTests({ rate: 20, overrides: {} });
    admin = await user({ role: 'admin' });
  });

  afterAll(async () => {
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "MarketingLeads" WHERE "assignedToMarketingUserId" IN (:ids)');
      await q('DELETE FROM "ReferralCodes" WHERE "marketingUserId" IN (:ids)');
      await removeMembers(ids);
    }
    for (const tag of tags) await sequelize.query('DELETE FROM "AuditLogs" WHERE action = :a', { replacements: { a: tag } }).catch(() => {});
  });

  describe('moving leads between partners', () => {
    t('moves open leads, and leaves converted ones with the partner who earned them', async () => {
      const from = await partner();
      const to = await partner();
      const buyer = await user();
      const open1 = await lead(from);
      const open2 = await lead(from, { status: 'contacted' });
      const lost = await lead(from, { status: 'lost' });
      const converted = await lead(from, { status: 'converted', convertedUserId: buyer.id });
      await sub(buyer.id);

      const r = await reassign.reassignLeads({ fromUserId: from.id, toUserId: to.id });
      // Only open ones (new/contacted); lost and converted are not part of a bulk hand-over.
      expect(r).toMatchObject({ moved: 2, skippedConverted: 0 });

      const owner = async (l) => (await models.MarketingLead.findByPk(l.id)).assignedToMarketingUserId;
      expect(await owner(open1)).toBe(to.id);
      expect(await owner(open2)).toBe(to.id);
      expect(await owner(lost)).toBe(from.id);
      expect(await owner(converted)).toBe(from.id);

      // The earning partner's money is untouched.
      const { buildMarketingReport } = require('../../../utils/marketingReport');
      expect((await buildMarketingReport(from.id)).summary.revenue).toBe(1000);
      expect((await buildMarketingReport(to.id)).summary.revenue).toBe(0);
    });

    t('refuses to move a converted lead even when asked for it by id', async () => {
      const from = await partner();
      const to = await partner();
      const buyer = await user();
      const converted = await lead(from, { status: 'converted', convertedUserId: buyer.id });
      const r = await reassign.reassignLeads({ leadIds: [converted.id], toUserId: to.id });
      expect(r).toMatchObject({ moved: 0, skippedConverted: 1 });
      expect((await models.MarketingLead.findByPk(converted.id)).assignedToMarketingUserId).toBe(from.id);
    });

    t('skips people the new partner already has, and does not let two in one batch collide', async () => {
      const from = await partner();
      const to = await partner();
      await lead(to, { phone: '9876500001' });
      const dup = await lead(from, { phone: '9876500001' });
      const a = await lead(from, { phone: '9876500002' });
      const b = await lead(from, { phone: '9876500002' }); // same person twice on the old list
      const r = await reassign.reassignLeads({ fromUserId: from.id, toUserId: to.id });
      expect(r).toMatchObject({ moved: 1, skippedDuplicate: 2 });
      expect((await models.MarketingLead.findByPk(dup.id)).assignedToMarketingUserId).toBe(from.id);
      const movedOwners = [(await models.MarketingLead.findByPk(a.id)), (await models.MarketingLead.findByPk(b.id))].map((l) => l.assignedToMarketingUserId);
      expect(movedOwners.filter((o) => o === to.id)).toHaveLength(1);
    });

    t('only hands leads to an active partner', async () => {
      const from = await partner();
      await lead(from);
      const inactive = await partner({ status: 'inactive' });
      const member = await user();
      await expect(reassign.reassignLeads({ fromUserId: from.id, toUserId: inactive.id })).rejects.toThrow(/not active/);
      await expect(reassign.reassignLeads({ fromUserId: from.id, toUserId: member.id })).rejects.toThrow(/not a marketing partner/);
    });

    t('puts a deactivated partner\'s people back to work: a signup is credited to the new partner', async () => {
      const gone = await partner();
      const heir = await partner();
      const phone = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
      await lead(gone, { phone: `91${phone}` });
      await models.User.update({ status: 'inactive' }, { where: { id: gone.id } });

      // While their partner is inactive nobody earns this signup.
      expect(await manualLeads.findManualLeadForSignup({ phone })).toBeNull();

      await reassign.reassignLeads({ fromUserId: gone.id, toUserId: heir.id });
      const found = await manualLeads.findManualLeadForSignup({ phone });
      expect(found.assignedToMarketingUserId).toBe(heir.id);
    });

    t('the admin endpoints explain each refusal and audit only real moves', async () => {
      const from = await partner();
      const to = await partner();
      const buyer = await user();
      const open = await lead(from);
      const converted = await lead(from, { convertedUserId: buyer.id, status: 'converted' });
      audit.mockClear();

      const bad = await call(adminCtl.assignLead, { user: admin, params: { leadId: converted.id }, body: { marketingUserId: to.id } });
      expect(bad.statusCode).toBe(409);
      expect(bad.body.error.message).toMatch(/already become a member/);
      expect(audit).not.toHaveBeenCalledWith('lead_reassigned', expect.anything(), expect.anything());

      const ok = await call(adminCtl.assignLead, { user: admin, params: { leadId: open.id }, body: { marketingUserId: to.id } });
      expect(ok.statusCode).toBe(200);
      expect(audit).toHaveBeenCalledWith('lead_reassigned', admin.id, expect.objectContaining({ leadId: open.id, fromUserId: from.id }));

      const again = await call(adminCtl.assignLead, { user: admin, params: { leadId: open.id }, body: { marketingUserId: to.id } });
      expect(again.statusCode).toBe(400);
      expect(again.body.error.message).toMatch(/already belongs/);

      const missing = await call(adminCtl.assignLead, { user: admin, params: { leadId: '00000000-0000-4000-8000-000000000000' }, body: { marketingUserId: to.id } });
      expect(missing.statusCode).toBe(404);
    });

    t('bulk hand-over reports what moved and what stayed, and the partner list shows open leads', async () => {
      const from = await partner();
      const to = await partner();
      const buyer = await user();
      await lead(from); await lead(from, { status: 'contacted' });
      await lead(from, { convertedUserId: buyer.id, status: 'converted' });

      const list = await call(adminCtl.getMarketingUsers, { user: admin, query: { limit: '100' } });
      expect(list.body.users.find((u) => u.id === from.id).openLeads).toBe(2);

      const res = await call(adminCtl.reassignPartnerLeads, { user: admin, params: { userId: from.id }, body: { toUserId: to.id } });
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ moved: 2, skippedDuplicate: 0 });
      expect(res.body.message).toMatch(/Moved 2 leads/);

      const same = await call(adminCtl.reassignPartnerLeads, { user: admin, params: { userId: from.id }, body: { toUserId: from.id } });
      expect(same.statusCode).toBe(400);
    });
  });

  describe('marketing manager team view', () => {
    const gate = (u) => new Promise((resolve) => teamCtl.requireTeamView({ user: u }, {}, (err) => resolve(err || null)));

    t('is for managers and admins only', async () => {
      expect((await gate({ role: 'marketing' })).statusCode).toBe(403);
      expect((await gate({ role: 'user' })).statusCode).toBe(403);
      expect((await gate(undefined)).statusCode).toBe(403);
      for (const role of ['marketing_manager', 'admin', 'super_admin']) expect(await gate({ role })).toBeNull();
    });

    t('shows each partner\'s numbers, agreeing with the partner\'s own report, and nothing personal', async () => {
      const rep = await partner();
      const buyer = await user();
      const refunded = await user();
      await lead(rep, { convertedUserId: buyer.id, status: 'converted' });
      await lead(rep, { convertedUserId: refunded.id, status: 'converted' });
      await lead(rep);                                    // open lead, not yet a member
      await sub(buyer.id, { amount: 1000, refundedAmount: 250 });          // partial refund: nets 750
      await sub(refunded.id, { amount: 800, refundedAt: new Date(), refundedAmount: 800 }); // fully refunded: not money taken
      await models.ReferralCode.create({ code: `T${uniq().toUpperCase()}`, marketingUserId: rep.id, isActive: true, usageCount: 0 });

      const res = await call(teamCtl.getTeam, { user: { id: 'x', role: 'marketing_manager' } });
      const row = res.body.partners.find((p) => p.id === rep.id);
      expect(row).toMatchObject({ totalLeads: 3, signedUp: 2, paidMembers: 1, revenue: 750, commissionRate: 20, commissionEarned: 150, activeCodes: 1, openLeads: 1 });

      // Same figures the partner sees on their own dashboard.
      const { buildMarketingReport } = require('../../../utils/marketingReport');
      const own = (await buildMarketingReport(rep.id)).summary;
      expect(row).toMatchObject({ totalLeads: own.totalLeads, signedUp: own.signedUp, paidMembers: own.paidMembers, revenue: own.revenue, commissionEarned: own.commissionEarned });

      // Numbers only: nothing identifying a member, nothing about payouts.
      const keys = Object.keys(row);
      for (const banned of ['phone', 'members', 'payout', 'payouts', 'paidOut', 'password']) expect(keys).not.toContain(banned);
      expect(JSON.stringify(res.body)).not.toContain(buyer.email);

      expect(res.body.totals.partners).toBeGreaterThanOrEqual(1);
      expect(res.body.totals.revenue).toBeGreaterThanOrEqual(750);
    });
  });

  describe('audit log', () => {
    const tagFor = () => { const a = `test_audit_${uniq()}`; tags.push(a); return a; };
    const log = (query) => call(analyticsCtl.getAuditLog, { user: admin, query });

    t('filters by action, by who did it (id or part of an email) and by who it was about', async () => {
      const action = tagFor();
      const alice = await user({ email: `alice-${uniq()}@audit.example.test` });
      const bob = await user({ email: `bob-${uniq()}@audit.example.test` });
      const target = await user({ email: `target-${uniq()}@audit.example.test` });
      await models.AuditLog.create({ action, actorId: alice.id, targetUserId: target.id, details: { n: 1 } });
      await models.AuditLog.create({ action, actorId: bob.id, targetUserId: null, details: { n: 2 } });

      expect((await log({ action })).body.pagination.total).toBe(2);
      expect((await log({ action, actor: alice.id })).body.entries.map((e) => e.details.n)).toEqual([1]);
      // A fragment of the email finds the same person.
      const byEmail = await log({ action, actor: alice.email.split('@')[0] });
      expect(byEmail.body.entries.map((e) => e.details.n)).toEqual([1]);
      const about = await log({ action, target: target.email.slice(0, 12) });
      expect(about.body.entries).toHaveLength(1);
      expect(about.body.entries[0].TargetUser.email).toBe(target.email);
      expect((await log({ action, actor: 'no-such-person-anywhere' })).body.entries).toHaveLength(0);
    });

    t('filters by date as whole India days', async () => {
      const action = tagFor();
      // 11 Oct 00:30 IST is still 10 Oct in UTC: it must belong to the 11th.
      await models.AuditLog.create({ action, details: { n: 'early-ist' }, createdAt: new Date('2026-10-10T19:00:00Z') });
      await models.AuditLog.create({ action, details: { n: 'late-ist' }, createdAt: new Date('2026-10-11T18:00:00Z') });  // 23:30 IST on the 11th
      await models.AuditLog.create({ action, details: { n: 'next-day' }, createdAt: new Date('2026-10-11T19:00:00Z') }); // 00:30 IST on the 12th

      const day = await log({ action, from: '2026-10-11', to: '2026-10-11' });
      expect(day.body.entries.map((e) => e.details.n).sort()).toEqual(['early-ist', 'late-ist']);
      const from12 = await log({ action, from: '2026-10-12' });
      expect(from12.body.entries.map((e) => e.details.n)).toEqual(['next-day']);
      // Nonsense dates are ignored, not an error.
      expect((await log({ action, from: 'tomorrow', to: '31/12/2026' })).body.pagination.total).toBe(3);
    });

    t('pages newest first and lists the actions that exist', async () => {
      const action = tagFor();
      for (let i = 0; i < 5; i += 1) await models.AuditLog.create({ action, details: { i }, createdAt: new Date(Date.now() - i * 1000) });
      const p1 = await log({ action, limit: '2', page: '1' });
      expect(p1.body.entries.map((e) => e.details.i)).toEqual([0, 1]);
      expect(p1.body.pagination).toMatchObject({ total: 5, pages: 3 });
      expect((await log({ action, limit: '2', page: '3' })).body.entries.map((e) => e.details.i)).toEqual([4]);

      const actions = await call(analyticsCtl.getAuditActions, { user: admin });
      expect(actions.body.actions.find((a) => a.action === action)).toEqual({ action, count: 5 });
    });

    t('exports the filtered log as a CSV, in India time, with no cap', async () => {
      const action = tagFor();
      const actor = await user({ email: `csv-${uniq()}@audit.example.test` });
      for (let i = 0; i < 3; i += 1) await models.AuditLog.create({ action, actorId: actor.id, details: { i, note: 'a,b "quoted"' } });
      audit.mockClear();

      const res = await callStream(analyticsCtl.getAuditLog, { user: admin, query: { action, format: 'csv' } });
      const rows = res.body.replace(/^\uFEFF/, '').split('\n').filter(Boolean);
      expect(rows[0]).toBe('When (IST),Action,By,By role,About,Details');
      expect(rows).toHaveLength(1 + 3);
      expect(res.headers['x-total-rows']).toBe('3');
      expect(rows[1]).toContain(actor.email);
      // The details cell is JSON (`\"quoted\"`) and then CSV-escaped (quotes doubled), so the row stays one row.
      expect(res.body).toContain('\\""quoted\\""');
      expect(audit).toHaveBeenCalledWith('audit_log_exported', admin.id, expect.objectContaining({ rows: 3 }));
    });

    t('writes one "record viewed" row per admin and member in a short window, not one per page load', async () => {
      const member = await user();
      audit.mockClear();
      for (let i = 0; i < 4; i += 1) await call(adminCtl.getUser, { user: admin, params: { userId: member.id } });
      const views = audit.mock.calls.filter((c) => c[0] === 'member_record_viewed' && c[2].targetUserId === member.id);
      expect(views).toHaveLength(1);

      // A different member is a different record, so it is logged separately.
      const other = await user();
      await call(adminCtl.getUser, { user: admin, params: { userId: other.id } });
      expect(audit.mock.calls.filter((c) => c[0] === 'member_record_viewed' && c[2].targetUserId === other.id)).toHaveLength(1);
    });
  });
});
