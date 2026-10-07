/**
 * Who is under which partner: the admin's Partner members list, the Marketing
 * Users list's search and numbers, the referral-code list, a member's partner
 * credit, and the report counts.
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

const { describeDb, makeMember, removeMembers, call, uniq } = require('../../helpers/db');

const DAY = 86400000;

describeDb('partner members', (t) => {
  const ids = [];
  let models; let sequelize; let adminCtl; let report; let commission;
  let admin; let repA; let repB; let joinedPaid; let joinedUnpaid; let prospect; let otherRep;

  const user = async (over = {}, profile = {}) => { const m = await makeMember({ user: over, profile }); ids.push(m.user.id); return m.user; };
  const phone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const lead = (rep, over = {}) => models.MarketingLead.create({
    name: 'Lead', phone: phone(), email: null,
    assignedToMarketingUserId: rep.id, status: 'new', source: 'manual', ...over,
  });
  const sub = (userId, over = {}) => models.Subscription.create({
    userId, planType: 'premium_plus', amount: 1000, status: 'active',
    startDate: new Date(Date.now() - 10 * DAY), endDate: new Date(Date.now() + 80 * DAY),
    contactUnlocksAllowed: null, razorpayPaymentId: `pay_${uniq()}`, razorpayOrderId: `order_${uniq()}`, ...over,
  });
  const leadsFor = (query) => call(adminCtl.getLeads, { user: admin, query: { marketingUserId: repA.id, ...query } });

  beforeAll(async () => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    adminCtl = require('../../../controllers/adminController');
    report = require('../../../utils/marketingReport');
    commission = require('../../../utils/marketingCommission');
    commission.__setCacheForTests({ rate: 20, overrides: {} });
    admin = await user({ role: 'admin' });
    repA = await user({ role: 'marketing' }, { firstName: 'Harpreet', lastName: `Rep${uniq().slice(0, 4)}` });
    repB = await user({ role: 'marketing', status: 'inactive' });
    otherRep = await user({ role: 'marketing' });

    const buyer = await user({}, { firstName: 'Gurleen', lastName: 'Paidmember' });
    const joiner = await user({}, { firstName: 'Simran', lastName: 'Joinedonly' });
    const code = `PM${uniq().slice(0, 6).toUpperCase()}`;
    await models.ReferralCode.create({ code, marketingUserId: repA.id, isActive: true, usageCount: 0 });

    // The lead's own payment flag says "none" although the member paid — the
    // stale-copy case the paid filter must see through. Two payments, so a
    // joined count would double it.
    joinedPaid = await lead(repA, { name: 'Lead name differs', referralCode: code, convertedUserId: buyer.id, status: 'converted', paymentStatus: 'none' });
    await sub(buyer.id, { amount: 1000, status: 'cancelled' });
    await sub(buyer.id, { amount: 500 });
    joinedUnpaid = await lead(repA, { name: 'Simran', referralCode: code, convertedUserId: joiner.id, status: 'converted' });
    prospect = await lead(repA, { name: 'Prospect Kaur', phone: '9811122233' });
    await lead(otherRep, { name: 'Someone else' });
  });

  afterAll(async () => {
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "MarketingLeads" WHERE "assignedToMarketingUserId" IN (:ids)');
      await q('DELETE FROM "ReferralCodes" WHERE "marketingUserId" IN (:ids)');
      await removeMembers(ids);
    }
  });

  t('lists one partner\'s people with what became of each, and counts each member once', async () => {
    const res = await leadsFor({});
    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toEqual({ total: 3, signedUp: 2, paid: 1 });
    expect(res.body.pagination.total).toBe(3);
    const paid = res.body.leads.find((l) => l.id === joinedPaid.id);
    expect(paid.member).toMatchObject({ paid: true, amountPaid: 1500, name: 'Gurleen Paidmember', planType: 'premium_plus' });
    expect(paid.partnerName).toMatch(/^Harpreet /);
    expect(res.body.leads.find((l) => l.id === prospect.id).member).toBeNull();
  });

  t('filters on real payments, not the copied flag', async () => {
    const yes = await leadsFor({ paid: 'yes' });
    expect(yes.body.leads.map((l) => l.id)).toEqual([joinedPaid.id]);
    const no = await leadsFor({ paid: 'no' });
    expect(no.body.leads.map((l) => l.id).sort()).toEqual([joinedUnpaid.id, prospect.id].sort());
  });

  t('filters on joined, and on how they came', async () => {
    expect((await leadsFor({ signedUp: 'no' })).body.leads.map((l) => l.id)).toEqual([prospect.id]);
    expect((await leadsFor({ signedUp: 'yes' })).body.summary.total).toBe(2);
    expect((await leadsFor({ source: 'manual' })).body.leads.map((l) => l.id)).toEqual([prospect.id]);
    expect((await leadsFor({ source: 'code' })).body.summary.total).toBe(2);
  });

  t('searches the member\'s own name and a phone typed with spaces', async () => {
    expect((await leadsFor({ search: 'paidmember' })).body.leads.map((l) => l.id)).toEqual([joinedPaid.id]);
    expect((await leadsFor({ search: '+91 98111 22233' })).body.leads.map((l) => l.id)).toEqual([prospect.id]);
    // A LIKE wildcard typed as text matches nothing rather than everything.
    expect((await leadsFor({ search: '%' })).body.summary.total).toBe(0);
  });

  t('date filters are whole IST days', async () => {
    const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    expect((await leadsFor({ from: today, to: today })).body.summary.total).toBe(3);
    expect((await leadsFor({ to: '2020-01-01' })).body.summary.total).toBe(0);
  });

  t('the partner report uses the same filters and does not double-count a member with two payments', async () => {
    const r = await report.buildMarketingReport(repA.id, {});
    expect(r.pagination.total).toBe(3);
    expect(r.summary.totalLeads).toBe(3);
    expect((await report.buildMarketingReport(repA.id, { paid: 'yes' })).members.map((m) => m.leadId)).toEqual([joinedPaid.id]);
    // The partner filter cannot be widened to someone else's leads.
    expect((await report.buildMarketingReport(repA.id, { marketingUserId: otherRep.id })).pagination.total).toBe(3);
  });

  t('Marketing Users: search by name, numbers per partner, and filters', async () => {
    const res = await call(adminCtl.getMarketingUsers, { user: admin, query: { search: 'harpreet' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.users.map((u) => u.id)).toEqual([repA.id]);
    expect(res.body.users[0].metrics).toMatchObject({ totalLeads: 3, signedUp: 2, paidMembers: 1, revenue: 1500, commissionEarned: 300 });
    expect(res.body.users[0].onboarding).toBeTruthy();

    const inactive = await call(adminCtl.getMarketingUsers, { user: admin, query: { status: 'inactive', limit: 100 } });
    expect(inactive.body.users.map((u) => u.id)).toContain(repB.id);
    expect(inactive.body.users.every((u) => u.status === 'inactive')).toBe(true);

    const byRevenue = await call(adminCtl.getMarketingUsers, { user: admin, query: { sort: 'revenue', limit: 100 } });
    const revenues = byRevenue.body.users.map((u) => u.metrics.revenue);
    expect(revenues).toEqual([...revenues].sort((a, b) => b - a));
  });

  t('referral codes report what each code brought in', async () => {
    const res = await call(adminCtl.getReferralCodes, { user: admin, query: { marketingUserId: repA.id } });
    expect(res.body.codes).toHaveLength(1);
    expect(res.body.codes[0]).toMatchObject({ people: 2, joined: 2, paid: 1 });
    const found = await call(adminCtl.getReferralCodes, { user: admin, query: { search: 'harpreet' } });
    expect(found.body.codes.map((c) => c.marketingUserId)).toEqual([repA.id]);
  });

  t('a member\'s record says which partner they came through', async () => {
    // Serialised the way the response is sent (User.toJSON).
    const wire = (r) => JSON.parse(JSON.stringify(r.body));
    const res = await call(adminCtl.getUser, { user: admin, params: { userId: joinedPaid.convertedUserId } });
    expect(wire(res).user.partnerCredit).toMatchObject({ partnerId: repA.id, leadId: joinedPaid.id });
    const none = await call(adminCtl.getUser, { user: admin, params: { userId: otherRep.id } });
    expect(wire(none).user.partnerCredit).toBeNull();
  });

  t('refuses a new code for a deactivated partner', async () => {
    const res = await call(adminCtl.createReferralCode, { user: admin, body: { code: `X${uniq().slice(0, 6)}`, marketingUserId: repB.id } });
    expect(res.statusCode).toBe(400);
  });
});
