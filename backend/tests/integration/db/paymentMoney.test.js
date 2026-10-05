/**
 * Money paths on a real database: revenue / commission across supersede, cancel,
 * partial and full refund; verify-payment racing the webhook; terms snapshot;
 * lead conversion from every activation leg; founding-claim and payout
 * concurrency; payout void; admin plan override atomicity.
 */

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/email', () => ({
  ...jest.requireActual('../../../utils/email'),
  sendEmail: jest.fn(async () => ({ success: true })),
  sendSubscriptionConfirmation: jest.fn(async () => ({ success: true })),
}));
jest.mock('../../../utils/razorpay', () => ({
  ...jest.requireActual('../../../utils/razorpay'),
  // The HMAC itself is covered by razorpay.test.js; here it is "valid".
  verifyPayment: jest.fn(() => true),
}));
jest.mock('../../../middlewares/logger', () => {
  const actual = jest.requireActual('../../../middlewares/logger');
  return { ...actual, logAudit: jest.fn() };
});

const { describeDb, makeMember, removeMembers, call, uniq } = require('../../helpers/db');

const DAY = 86400000;

describeDb('payment money paths', (t) => {
  const ids = [];
  let models; let sequelize; let report; let payouts; let launchOffer; let commission; let logger;

  const member = async (user = {}) => { const m = await makeMember({ user }); ids.push(m.user.id); return m.user; };
  const sub = (userId, over = {}) => models.Subscription.create({
    userId, planType: 'premium_plus', amount: 1100, status: 'active',
    startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 80 * DAY),
    contactUnlocksAllowed: null, razorpayPaymentId: `pay_${uniq()}`, razorpayOrderId: `order_${uniq()}`,
    ...over,
  });
  const pending = (userId, over = {}) => sub(userId, {
    status: 'pending', razorpayPaymentId: null, startDate: null, endDate: null, ...over,
  });
  const rep = async () => member({ role: 'marketing' });
  const lead = (repUser, buyer) => models.MarketingLead.create({
    name: 'Lead', phone: 'N/A', assignedToMarketingUserId: repUser.id, convertedUserId: buyer.id,
    referralCode: 'T', status: 'contacted',
  });

  beforeAll(() => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    report = require('../../../utils/marketingReport');
    payouts = require('../../../utils/marketingPayouts');
    launchOffer = require('../../../utils/launchOffer');
    commission = require('../../../utils/marketingCommission');
    logger = require('../../../middlewares/logger');
    commission.__setCacheForTests({ rate: 20, overrides: {} });
    launchOffer.__setCacheForTests({
      enabled: false, endsAt: null, plans: {}, bundles: {},
      founding: { enabled: true, endsAt: new Date(Date.now() + 30 * DAY).toISOString(), memberCap: 0, grantDays: 30, contactUnlocks: 3 },
      referral: { enabled: true, discountPaise: 10000, referrerUnlocks: 5 },
    });
  });

  afterAll(async () => {
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "MarketingPayouts" WHERE "marketingUserId" IN (:ids)');
      await q('DELETE FROM "MarketingLeads" WHERE "assignedToMarketingUserId" IN (:ids) OR "convertedUserId" IN (:ids)');
      await q('DELETE FROM "ReferralCodes" WHERE "marketingUserId" IN (:ids)');
      await q('DELETE FROM "Verifications" WHERE "userId" IN (:ids)');
    }
    await removeMembers(ids);
  });

  // ---------------------------------------------------------------- report

  t('marketing report: supersede, self-cancel, partial and full refund, admin grant', async () => {
    const r = await rep();
    const [a, b, c, d, e] = [await member(), await member(), await member(), await member(), await member()];
    await Promise.all([a, b, c, d, e].map((u) => lead(r, u)));

    // A: upgrade — the first payment sits on a SUPERSEDED (cancelled) row.
    await sub(a.id, { status: 'cancelled', amount: 1000 });
    await sub(a.id, { amount: 2000 });
    // B: partial refund keeps the plan, nets the money.
    await sub(b.id, { amount: 1100, refundedAmount: 400 });
    // C: full refund / lost dispute -> cancelled + refundedAt.
    await sub(c.id, { status: 'cancelled', amount: 1100, refundedAmount: 1100, refundedAt: new Date() });
    // D: admin grant — list price, NO payment id.
    await sub(d.id, { razorpayPaymentId: null, amount: 1100 });
    // E: member cancelled; policy keeps the money.
    await sub(e.id, { status: 'cancelled', amount: 1100 });

    const out = await report.buildMarketingReport(r.id, { limit: 50 });
    expect(out.summary.revenue).toBe(3000 + 700 + 1100);
    expect(out.summary.paidMembers).toBe(3);
    expect(out.summary.commissionEarned).toBe(Math.round(4800 * 0.2));

    const byId = new Map(out.members.map((m) => [m.email, m]));
    expect(byId.get(a.email)).toMatchObject({ paid: true, amountPaid: 3000, planStatus: 'active' });
    expect(byId.get(b.email).amountPaid).toBe(700);
    expect(byId.get(c.email).paid).toBe(false);
    expect(byId.get(d.email).paid).toBe(false);
    expect(byId.get(e.email)).toMatchObject({ paid: true, amountPaid: 1100 });

    // The rep dashboard tile reads the same figure as the report.
    expect(await report.getRepRevenue(r.id)).toBe(out.summary.revenue);
  });

  // ------------------------------------------------- verify vs webhook race

  t('verify-payment answers success when the webhook committed while it waited on the row lock', async () => {
    const { verifyPayment } = require('../../../controllers/subscriptionController');
    const buyer = await member();
    const row = await pending(buyer.id);
    const paymentId = `pay_${uniq()}`;

    // Stand in for the webhook: hold the row lock, activate, commit AFTER verify is waiting.
    const tx = await sequelize.transaction();
    await models.Subscription.findOne({ where: { id: row.id }, transaction: tx, lock: true });

    const pendingVerify = call(verifyPayment, {
      user: { id: buyer.id, role: 'user' },
      body: { razorpayOrderId: row.razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: 'sig' },
    });
    await new Promise((r) => setTimeout(r, 400));
    await models.Subscription.update(
      { status: 'active', razorpayPaymentId: paymentId, startDate: new Date(), endDate: new Date(Date.now() + 90 * DAY) },
      { where: { id: row.id }, transaction: tx },
    );
    await tx.commit();

    const res = await pendingVerify;
    expect(res.statusCode).toBe(200);
    expect(res.body.subscription.id).toBe(row.id);
    expect(res.body.subscription.status).toBe('active');
  });

  t('verify-payment still 404s for an order that has genuinely not been paid by that payment id', async () => {
    const { verifyPayment } = require('../../../controllers/subscriptionController');
    const buyer = await member();
    const row = await sub(buyer.id, { status: 'active' }); // already paid with ANOTHER payment id
    const res = await call(verifyPayment, {
      user: { id: buyer.id, role: 'user' },
      body: { razorpayOrderId: row.razorpayOrderId, razorpayPaymentId: `pay_${uniq()}`, razorpaySignature: 'sig' },
    });
    expect(res.statusCode).toBe(404);
  });

  // ------------------------------------------------------- terms snapshot

  t('activation uses the terms agreed at create-order, not the live plan (webhook leg)', async () => {
    const { activateCapturedPayment } = require('../../../utils/subscriptionActivation');
    const buyer = await member();
    const row = await pending(buyer.id, { orderTerms: { duration: 45, contactUnlocks: 7 } });
    await activateCapturedPayment(row.razorpayOrderId, `pay_${uniq()}`);
    const fresh = await models.Subscription.findByPk(row.id);
    expect(fresh.status).toBe('active');
    expect(fresh.contactUnlocksAllowed).toBe(7);
    const days = Math.round((new Date(fresh.endDate) - new Date(fresh.startDate)) / DAY);
    expect(days).toBe(45);
  });

  t('a snapshot of null unlocks stays UNLIMITED; no snapshot falls back to the live plan (verify leg)', async () => {
    const { verifyPayment } = require('../../../controllers/subscriptionController');
    const a = await member(); const b = await member();
    const withSnap = await pending(a.id, { orderTerms: { duration: 30, contactUnlocks: null } });
    const without = await pending(b.id, { orderTerms: null });
    for (const [u, row] of [[a, withSnap], [b, without]]) {
      const res = await call(verifyPayment, {
        user: { id: u.id, role: 'user' },
        body: { razorpayOrderId: row.razorpayOrderId, razorpayPaymentId: `pay_${uniq()}`, razorpaySignature: 'sig' },
      });
      expect(res.statusCode).toBe(200);
    }
    const s1 = await models.Subscription.findByPk(withSnap.id);
    expect(s1.contactUnlocksAllowed).toBeNull();
    expect(Math.round((new Date(s1.endDate) - new Date(s1.startDate)) / DAY)).toBe(30);
    const s2 = await models.Subscription.findByPk(without.id);
    const live = require('../../../utils/razorpay').getPlanDetails('premium_plus');
    expect(Math.round((new Date(s2.endDate) - new Date(s2.startDate)) / DAY)).toBe(live.duration);
  });

  // ------------------------------------------------- lead conversion legs

  t('every activation leg marks the rep lead paid (webhook leg used to leave it unpaid)', async () => {
    const { activateCapturedPayment } = require('../../../utils/subscriptionActivation');
    const r = await rep(); const buyer = await member();
    const l = await lead(r, buyer);
    const row = await pending(buyer.id);
    const paymentId = `pay_${uniq()}`;
    await activateCapturedPayment(row.razorpayOrderId, paymentId);
    const fresh = await models.MarketingLead.findByPk(l.id);
    expect(fresh).toMatchObject({ paymentStatus: 'paid', status: 'converted', paymentId });
    expect(Number(fresh.amountPaid)).toBe(1100);
  });

  // ------------------------------------------------------ founding claim

  t('four concurrent founding claims mint exactly one grant', async () => {
    const { claimFounding } = require('../../../controllers/subscriptionController');
    const u = await member();
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => call(claimFounding, { user: { id: u.id, role: 'user' } })),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    const rows = await models.Subscription.count({ where: { userId: u.id, planType: 'founding_premium' } });
    expect(rows).toBe(1);
  });

  // ------------------------------------------------------ payout ledger

  t('two concurrent payouts of the whole balance: one is recorded, one refused', async () => {
    const r = await rep(); const buyer = await member();
    await lead(r, buyer);
    // Past the 7-day refund window, so the whole 200 is payable.
    await sub(buyer.id, { amount: 1000, startDate: new Date(Date.now() - 10 * DAY) }); // 20% -> 200 earned
    const attempt = () => payouts.recordPayout(r.id, { amount: 200, status: 'paid' }, null)
      .then(() => 'ok', (e) => (e instanceof payouts.PayoutValidationError ? 'refused' : `error:${e.message}`));
    const outcomes = await Promise.all([attempt(), attempt()]);
    expect(outcomes.sort()).toEqual(['ok', 'refused']);
    const ledger = await payouts.getPayoutLedger(r.id);
    expect(ledger.summary).toMatchObject({ earned: 200, paidOut: 200, outstanding: 0 });
  });

  t('voiding a payout keeps the row, needs a reason, and frees the balance', async () => {
    const r = await rep(); const buyer = await member(); const admin = await member();
    await lead(r, buyer);
    await sub(buyer.id, { amount: 1000, startDate: new Date(Date.now() - 10 * DAY) });
    const p = await payouts.recordPayout(r.id, { amount: 150, status: 'paid' }, admin.id);

    await expect(payouts.voidPayout(p.id, { reason: '  ', adminId: admin.id })).rejects.toBeInstanceOf(payouts.PayoutValidationError);

    const voided = await payouts.voidPayout(p.id, { reason: 'Paid to the wrong account', adminId: admin.id });
    expect(voided.voidedAt).toBeTruthy();
    expect(voided.voidedBy).toBe(admin.id);

    const row = await models.MarketingPayout.findByPk(p.id); // still there
    expect(row.voidReason).toBe('Paid to the wrong account');

    const ledger = await payouts.getPayoutLedger(r.id);
    expect(ledger.summary).toMatchObject({ paidOut: 0, outstanding: 200 });
    expect(ledger.payouts[0]).toMatchObject({ id: p.id, voided: true });

    await expect(payouts.voidPayout(p.id, { reason: 'again please', adminId: admin.id })).rejects.toBeInstanceOf(payouts.PayoutValidationError);
    await expect(payouts.updatePayoutStatus(p.id, 'pending')).rejects.toBeInstanceOf(payouts.PayoutValidationError);
  });

  // ------------------------------------------------ admin plan override

  const override = (adminUser, userId, body) => {
    const { updateSubscription } = require('../../../controllers/adminController');
    return call(updateSubscription, { user: { id: adminUser.id, role: 'admin' }, params: { userId }, body });
  };

  t('a bad end date or status is refused BEFORE the member\'s plan is touched', async () => {
    const admin = await member(); const u = await member();
    const row = await sub(u.id);
    const badDate = await override(admin, u.id, { planType: 'premium_plus', endDate: 'bad' });
    expect(badDate.statusCode).toBe(400);
    const badStatus = await override(admin, u.id, { planType: 'vip', status: 'expired' });
    expect(badStatus.statusCode).toBe(400);
    expect((await models.Subscription.findByPk(row.id)).status).toBe('active');
  });

  t('overriding to the plan the member already holds (no new term) is refused and changes nothing', async () => {
    const admin = await member(); const u = await member();
    const row = await sub(u.id, { contactUnlocksUsed: 0 });
    const res = await override(admin, u.id, { planType: 'premium_plus' });
    expect(res.statusCode).toBe(409);
    expect((await models.Subscription.findByPk(row.id)).status).toBe('active');
  });

  t('override to free ends the plan, creates NO free row, and withdraws the unlimited-plan boost', async () => {
    const admin = await member(); const u = await member();
    await sub(u.id, { planType: 'vip' });
    await models.User.update({ isBoosted: true, boostExpiresAt: new Date(Date.now() + 30 * DAY) }, { where: { id: u.id } });

    const res = await override(admin, u.id, { planType: 'free', reason: 'Refunded off-platform' });
    expect(res.statusCode).toBe(200);
    expect(res.body.subscription).toBeNull();
    expect(await models.Subscription.count({ where: { userId: u.id, status: 'active' } })).toBe(0);
    expect(await models.Subscription.count({ where: { userId: u.id, planType: 'free' } })).toBe(0);
    const fresh = await models.User.findByPk(u.id);
    expect(fresh.isBoosted).toBe(false);
    expect(fresh.boostExpiresAt).toBeNull();
  });

  t('a valid override swaps the plan in one go and the audit row carries the previous plan and reason', async () => {
    const admin = await member(); const u = await member();
    await sub(u.id, { planType: 'basic_premium', contactUnlocksAllowed: 5, contactUnlocksUsed: 3 });
    logger.logAudit.mockClear();
    const res = await override(admin, u.id, { planType: 'premium_plus', reason: 'Goodwill upgrade' });
    expect(res.statusCode).toBe(200);
    const live = await models.Subscription.findAll({ where: { userId: u.id, status: 'active' } });
    expect(live).toHaveLength(1);
    expect(live[0].planType).toBe('premium_plus');
    const call0 = logger.logAudit.mock.calls.find(([a]) => a === 'subscription_overridden');
    expect(call0[2]).toMatchObject({
      reason: 'Goodwill upgrade',
      previous: { planType: 'basic_premium', contactUnlocksUsed: 3 },
    });
  });

  // ------------------------------------------------------------ analytics

  t('analytics hides money from a sub-admin without the revenue scope', async () => {
    const { getAnalytics } = require('../../../controllers/adminController');
    const noRevenue = await call(getAnalytics, { user: { id: 'x', role: 'sub_admin', adminPermissions: ['users'] } });
    expect(noRevenue.statusCode).toBe(200);
    expect(noRevenue.body.stats.revenueThisMonth).toBeNull();
    expect(noRevenue.body.revenue).toEqual([]);
    expect(noRevenue.body.planDistribution).toEqual([]);

    const full = await call(getAnalytics, { user: { id: 'x', role: 'admin' } });
    expect(typeof full.body.stats.revenueThisMonth).toBe('number');
    // 30-day series has no gaps: a day with no signups is a 0, not a hole.
    expect(full.body.registrations.length).toBeGreaterThanOrEqual(30);
    expect(full.body.stats).toHaveProperty('paidSubscribers');
    expect(full.body.stats).toHaveProperty('foundingActive');
  });

  // -------------------------------------------------------- verifications

  t('verification queue: flagged is a real status and `all` returns every status', async () => {
    const { getVerifications } = require('../../../controllers/adminController');
    const u1 = await member(); const u2 = await member();
    await models.Verification.create({ userId: u1.id, status: 'flagged' });
    await models.Verification.create({ userId: u2.id, status: 'approved' });
    const admin = { id: 'x', role: 'admin' };

    const flagged = await call(getVerifications, { user: admin, query: { status: 'flagged', limit: '200' } });
    expect(flagged.body.verifications.every((v) => v.status === 'flagged')).toBe(true);
    expect(flagged.body.verifications.map((v) => v.userId)).toContain(u1.id);

    const all = await call(getVerifications, { user: admin, query: { status: 'all', limit: '200' } });
    const got = all.body.verifications.map((v) => v.userId);
    expect(got).toEqual(expect.arrayContaining([u1.id, u2.id]));

    const dflt = await call(getVerifications, { user: admin, query: {} });
    expect(dflt.body.verifications.every((v) => v.status === 'pending')).toBe(true);
  });

  // ------------------------------------------------------------ referral codes

  t('admin referral code: normalised, bad characters refused, case-insensitive duplicate refused', async () => {
    const { createReferralCode } = require('../../../controllers/adminController');
    const admin = { id: 'x', role: 'admin' };
    const r = await rep();
    const tag = uniq().toUpperCase();

    const ok = await call(createReferralCode, { user: admin, body: { code: ` sec-${tag} `, marketingUserId: r.id } });
    expect(ok.statusCode).toBe(201);
    expect(ok.body.referralCode.code).toBe(`SEC-${tag}`);

    const dup = await call(createReferralCode, { user: admin, body: { code: `sec-${tag.toLowerCase()}`, marketingUserId: r.id } });
    expect(dup.statusCode).toBe(409);

    const bad = await call(createReferralCode, { user: admin, body: { code: 'SECTOR_17', marketingUserId: r.id } });
    expect(bad.statusCode).toBe(400);
  });

  t('deactivating a rep also deactivates their referral codes; reactivating does not revive them', async () => {
    const { updateMarketingUserStatus } = require('../../../controllers/adminController');
    const admin = { id: 'x', role: 'admin' };
    const r = await rep();
    const code = await models.ReferralCode.create({ code: `T${uniq().toUpperCase()}`, marketingUserId: r.id, isActive: true, usageCount: 0 });

    const off = await call(updateMarketingUserStatus, { user: admin, params: { userId: r.id }, body: { status: 'inactive' } });
    expect(off.statusCode).toBe(200);
    expect((await models.ReferralCode.findByPk(code.id)).isActive).toBe(false);

    await call(updateMarketingUserStatus, { user: admin, params: { userId: r.id }, body: { status: 'active' } });
    expect((await models.ReferralCode.findByPk(code.id)).isActive).toBe(false);
  });

  // ------------------------------------------------ entitlement + history

  t('requirePremium prefers the newest live plan when more than one row is active', async () => {
    const { requirePremium } = require('../../../middlewares/auth');
    const u = await member();
    await sub(u.id, { planType: 'basic_premium', createdAt: new Date(Date.now() - 5 * DAY) });
    const newest = await sub(u.id, { planType: 'premium_plus' });
    const req = { user: { id: u.id } };
    await new Promise((resolve, reject) => {
      requirePremium(req, {}, (err) => (err ? reject(err) : resolve()));
    });
    expect(req.subscription.id).toBe(newest.id);
  });

  t('payment history returns the refund fields so the page can net them', async () => {
    const { getPaymentHistory } = require('../../../controllers/subscriptionController');
    const u = await member();
    await sub(u.id, { refundedAmount: 400 });
    const res = await call(getPaymentHistory, { user: { id: u.id, role: 'user' } });
    const row = JSON.parse(JSON.stringify(res.body.subscriptions[0]));
    expect(Number(row.refundedAmount)).toBe(400);
    expect(row).toHaveProperty('refundedAt');
    expect(row).not.toHaveProperty('orderTerms');
  });
});
