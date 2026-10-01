/**
 * Checkout referral codes on a real database: quote → paid → settle.
 */

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));

const { describeDb, makeMember, removeMembers, uniq } = require('../../helpers/db');

describeDb('checkout referral codes', (t) => {
  const ids = [];
  let models; let sequelize; let referral; let launchOffer;
  const PLAN = { amount: 109900 };

  const member = async (user = {}) => { const m = await makeMember({ user }); ids.push(m.user.id); return m.user; };
  const paidSub = (userId, referralBlock, over = {}) => models.Subscription.create({
    userId, planType: 'premium_plus', amount: 999, status: 'active',
    startDate: new Date(), endDate: new Date(Date.now() + 90 * 86400000),
    contactUnlocksAllowed: null, razorpayPaymentId: `pay_${uniq()}`,
    razorpayOrderId: `order_${uniq()}`, referral: referralBlock, ...over,
  });

  beforeAll(() => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    referral = require('../../../utils/referral');
    launchOffer = require('../../../utils/launchOffer');
    launchOffer.__setCacheForTests({
      enabled: true, endsAt: null, plans: {}, bundles: {},
      referral: { enabled: true, discountPaise: 10000, referrerUnlocks: 5 },
    });
  });
  afterAll(async () => {
    if (ids.length) {
      await sequelize.query('DELETE FROM "MarketingLeads" WHERE "assignedToMarketingUserId" IN (:ids) OR "convertedUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
      await sequelize.query('DELETE FROM "ReferralCodes" WHERE "marketingUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });

  t('mints a stable, typeable member code', async () => {
    const u = await member();
    const a = await referral.getOrCreateMemberCode(u.id);
    expect(a).toMatch(/^TM[A-HJ-NP-Z2-9]{6}$/);
    expect(await referral.getOrCreateMemberCode(u.id)).toBe(a);
  });

  t('quotes ₹100 off a member code, case-insensitively, and refuses the buyer\'s own code', async () => {
    const referrer = await member(); const buyer = await member();
    const code = await referral.getOrCreateMemberCode(referrer.id);

    const q = await referral.quoteReferral(` ${code.toLowerCase()} `, PLAN, buyer.id);
    expect(q.discountPaise).toBe(10000);
    expect(q.finalPaise).toBe(99900);
    expect(q.referral).toMatchObject({ kind: 'member', code, referrerUserId: referrer.id });

    await expect(referral.quoteReferral(code, PLAN, referrer.id)).rejects.toMatchObject({ code: 'REFERRAL_SELF' });
    await expect(referral.quoteReferral('NOPE1234', PLAN, buyer.id)).rejects.toBeInstanceOf(referral.ReferralError);
  });

  t('caps the discount to a share of a cheap plan', async () => {
    const referrer = await member(); const buyer = await member();
    const code = await referral.getOrCreateMemberCode(referrer.id);
    const q = await referral.quoteReferral(code, { amount: 20000 }, buyer.id);
    expect(q.discountPaise).toBe(6000);
  });

  t('only the first paid purchase gets a discount', async () => {
    const referrer = await member(); const buyer = await member();
    const code = await referral.getOrCreateMemberCode(referrer.id);
    await paidSub(buyer.id, null);
    await expect(referral.quoteReferral(code, PLAN, buyer.id)).rejects.toMatchObject({ code: 'REFERRAL_NOT_FIRST' });
  });

  t('refuses everything while the programme is switched off', async () => {
    const referrer = await member(); const buyer = await member();
    const code = await referral.getOrCreateMemberCode(referrer.id);
    launchOffer.__setCacheForTests({ enabled: true, referral: { enabled: false, discountPaise: 10000, referrerUnlocks: 5 } });
    await expect(referral.quoteReferral(code, PLAN, buyer.id)).rejects.toMatchObject({ code: 'REFERRAL_DISABLED' });
    launchOffer.__setCacheForTests({ enabled: true, referral: { enabled: true, discountPaise: 10000, referrerUnlocks: 5 } });
  });

  t('a paid member-code order credits the referrer ONCE, however many legs activate it', async () => {
    const referrer = await member(); const buyer = await member();
    const code = await referral.getOrCreateMemberCode(referrer.id);
    const q = await referral.quoteReferral(code, PLAN, buyer.id);
    const sub = await paidSub(buyer.id, q.referral);

    const [a, b] = await Promise.all([referral.settleReferral(sub.id), referral.settleReferral(sub.id)]);
    expect([a.settled, b.settled].filter(Boolean)).toHaveLength(1);
    await referral.settleReferral(sub.id);

    // Referrer holds no subscription, so the credit parks as pending.
    const fresh = await models.User.findByPk(referrer.id, { attributes: ['pendingUnlockCredits'] });
    expect(fresh.pendingUnlockCredits).toBe(5);

    const summary = await referral.getReferralSummary(referrer.id);
    expect(summary.stats).toMatchObject({ paid: 1, unlocksEarned: 5 });
  });

  t('an unpaid order earns nothing', async () => {
    const referrer = await member(); const buyer = await member();
    const code = await referral.getOrCreateMemberCode(referrer.id);
    const q = await referral.quoteReferral(code, PLAN, buyer.id);
    const sub = await paidSub(buyer.id, q.referral, { status: 'pending', razorpayPaymentId: null });
    expect((await referral.settleReferral(sub.id)).settled).toBe(false);
    const fresh = await models.User.findByPk(referrer.id, { attributes: ['pendingUnlockCredits'] });
    expect(fresh.pendingUnlockCredits).toBe(0);
  });

  t('stops paying a referrer at the lifetime cap but still leaves the buyer their discount', async () => {
    const referrer = await member();
    const code = await referral.getOrCreateMemberCode(referrer.id);
    const filler = await member();
    for (let i = 0; i < 20; i += 1) {
      await paidSub(filler.id, { kind: 'member', code, referrerUserId: referrer.id, discountPaise: 10000, rewardedAt: new Date().toISOString(), rewardUnlocks: 5 }, { status: 'expired' });
    }
    const buyer = await member();
    const q = await referral.quoteReferral(code, PLAN, buyer.id);
    expect(q.discountPaise).toBe(10000);
    const sub = await paidSub(buyer.id, q.referral);
    expect(await referral.settleReferral(sub.id)).toMatchObject({ rewarded: false, reason: 'cap' });
    const fresh = await models.User.findByPk(referrer.id, { attributes: ['pendingUnlockCredits'] });
    expect(fresh.pendingUnlockCredits).toBe(0);
  });

  t('a marketing code at checkout creates the lead + attribution the rep is paid commission on', async () => {
    const rep = await member({ role: 'marketing' }); const buyer = await member();
    const code = `REP${uniq().toUpperCase()}`;
    await models.ReferralCode.create({ code, marketingUserId: rep.id, campaign: 'test' });

    const q = await referral.quoteReferral(code, PLAN, buyer.id);
    expect(q.referral).toMatchObject({ kind: 'marketing', marketingUserId: rep.id });
    const sub = await paidSub(buyer.id, q.referral);
    await referral.settleReferral(sub.id);

    const lead = await models.MarketingLead.findOne({ where: { convertedUserId: buyer.id } });
    expect(lead).toMatchObject({ assignedToMarketingUserId: rep.id, status: 'converted', paymentStatus: 'paid', referralCode: code });
    const fresh = await models.User.findByPk(buyer.id, { attributes: ['referredByMarketingUserId', 'referralCodeUsed'] });
    expect(fresh.referredByMarketingUserId).toBe(rep.id);
    const rc = await models.ReferralCode.findOne({ where: { code } });
    expect(rc.usageCount).toBe(1);
  });

  t('first touch wins: a buyer already attributed to one rep is not re-assigned', async () => {
    const repA = await member({ role: 'marketing' }); const repB = await member({ role: 'marketing' }); const buyer = await member();
    const codeA = `REP${uniq().toUpperCase()}`; const codeB = `REP${uniq().toUpperCase()}`;
    await models.ReferralCode.create({ code: codeA, marketingUserId: repA.id });
    await models.ReferralCode.create({ code: codeB, marketingUserId: repB.id });
    await models.MarketingLead.create({ name: 'B', phone: 'N/A', assignedToMarketingUserId: repA.id, referralCode: codeA, convertedUserId: buyer.id, status: 'contacted' });

    const q = await referral.quoteReferral(codeB, PLAN, buyer.id);
    const sub = await paidSub(buyer.id, q.referral);
    await referral.settleReferral(sub.id);

    const leads = await models.MarketingLead.findAll({ where: { convertedUserId: buyer.id } });
    expect(leads).toHaveLength(1);
    expect(leads[0].assignedToMarketingUserId).toBe(repA.id);
  });
});
