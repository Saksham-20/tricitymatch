/**
 * Fixed launch term, end to end on a real database (owner decision
 * 2026-10-09): create-order -> payment -> the plan's end date, on both
 * activation legs, at different points in the offer window.
 *
 *   offer 11 Oct 2026 - 10 Jan 2027 (ends 23:59:59 IST)
 *   bought before 11 Dec  -> ends 10 Jan 2027
 *   bought from 11 Dec    -> ends 10 Feb 2027 (one extra month)
 *   bought after the offer -> regular plan, 3 calendar months from purchase
 */

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/email', () => ({
  ...jest.requireActual('../../../utils/email'),
  sendEmail: jest.fn(async () => ({ success: true })),
  sendSubscriptionConfirmation: jest.fn(async () => ({ success: true })),
}));
jest.mock('../../../utils/razorpay', () => {
  const actual = jest.requireActual('../../../utils/razorpay');
  let n = 0;
  return {
    ...actual,
    // No gateway call: an order id and the amount the real code would charge.
    createOrder: jest.fn(async (planType, userId, opts = {}) => {
      n += 1;
      const plan = actual.getPlanDetails(planType);
      return { orderId: `order_ft_${Date.now()}_${n}`, amount: plan.amount - (opts.discountPaise || 0), currency: 'INR' };
    }),
    verifyPayment: jest.fn(() => true),
  };
});

// The test env carries no gateway keys; checkout only asks whether it has them.
jest.mock('../../../config/env', () => {
  const actual = jest.requireActual('../../../config/env');
  return { ...actual, razorpay: { ...actual.razorpay, isConfigured: () => true } };
});

const { describeDb, makeMember, removeMembers, call, uniq } = require('../../helpers/db');

const OFFER_END = '2027-01-10T18:29:59.999Z';
const istDate = (d) => new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10);

describeDb('fixed launch term flow', (t) => {
  const ids = [];
  let models; let launchOffer; let ctrl; let activation; let email;

  const member = async () => { const m = await makeMember({}); ids.push(m.user.id); return m.user; };
  const clock = (iso) => jest.useFakeTimers({
    now: new Date(iso),
    doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
  });

  // Buy Premium at `iso`: create the order, then confirm it on one leg.
  const buy = async (iso, leg = 'verify') => {
    clock(iso);
    const u = await member();
    const order = await call(ctrl.createOrder, { user: { id: u.id, role: 'user' }, body: { planType: 'premium_plus' } });
    expect(order.statusCode).toBe(200);
    const orderId = order.body.order.id;
    if (leg === 'verify') {
      const res = await call(ctrl.verifyPayment, {
        user: { id: u.id, role: 'user' },
        body: { razorpayOrderId: orderId, razorpayPaymentId: `pay_${uniq()}`, razorpaySignature: 'sig' },
      });
      expect(res.statusCode).toBe(200);
    } else {
      await activation.activateCapturedPayment(orderId, `pay_${uniq()}`);
    }
    const sub = await models.Subscription.findOne({ where: { razorpayOrderId: orderId } });
    return { u, sub, order: order.body };
  };

  beforeAll(() => {
    models = require('../../../models');
    launchOffer = require('../../../utils/launchOffer');
    ctrl = require('../../../controllers/subscriptionController');
    activation = require('../../../utils/subscriptionActivation');
    email = require('../../../utils/email');
    launchOffer.__setCacheForTests({
      enabled: true,
      endsAt: OFFER_END,
      headline: 'Launch offer',
      subline: null,
      plans: {
        basic_premium: { hidden: true }, elite: { hidden: true }, vip: { hidden: true }, nri: { hidden: true },
        premium_plus: { amount: 110000, duration: 90, contactUnlocks: null, mrp: 250000 },
      },
      bundles: {},
      founding: { enabled: false },
      referral: { enabled: true, discountPaise: 10000, referrerUnlocks: 5 },
      fixedTerm: { enabled: true, lateBonusMonths: 1 },
    });
  });
  afterEach(() => jest.useRealTimers());
  afterAll(async () => { await removeMembers(ids); });

  t('launch day: ₹1,100, snapshot carries the offer end, plan ends 10 Jan 2027', async () => {
    const { sub } = await buy('2026-10-11T04:30:00Z');
    expect(Number(sub.amount)).toBe(1100);
    expect(sub.orderTerms.endsOn).toBe(OFFER_END);
    expect(sub.status).toBe('active');
    expect(sub.contactUnlocksAllowed).toBeNull();
    expect(new Date(sub.endDate).toISOString()).toBe(OFFER_END);
    // The confirmation mail is handed the real end date and prints it plainly.
    await new Promise((r) => setImmediate(r)); // the mail is sent on the next tick
    const [, , , expiry] = email.sendSubscriptionConfirmation.mock.calls.at(-1);
    expect(email.memberDate(expiry)).toBe('10 January 2027');
    expect(email.templates.subscriptionConfirmation('A', 'premium_plus', expiry).text)
      .toContain('valid until 10 January 2027');
  });

  t('second month, webhook leg: still ends 10 Jan 2027', async () => {
    const { sub } = await buy('2026-11-25T10:00:00Z', 'webhook');
    expect(istDate(sub.endDate)).toBe('2027-01-10');
  });

  t('23:59 IST on 10 Dec is still the second month', async () => {
    const { sub } = await buy('2026-12-10T18:29:00Z');
    expect(istDate(sub.endDate)).toBe('2027-01-10');
  });

  t('final month (from 00:00 IST 11 Dec): ends 10 Feb 2027', async () => {
    const early = await buy('2026-12-10T18:30:00Z');
    expect(istDate(early.sub.endDate)).toBe('2027-02-10');
    const late = await buy('2027-01-10T15:00:00Z', 'webhook');
    expect(istDate(late.sub.endDate)).toBe('2027-02-10');
  });

  t('an order opened in the second month and paid in the final month keeps the date it was sold with', async () => {
    clock('2026-12-10T12:00:00Z');
    const u = await member();
    const order = await call(ctrl.createOrder, { user: { id: u.id, role: 'user' }, body: { planType: 'premium_plus' } });
    clock('2026-12-11T06:00:00Z');
    await activation.activateCapturedPayment(order.body.order.id, `pay_${uniq()}`);
    const sub = await models.Subscription.findOne({ where: { razorpayOrderId: order.body.order.id } });
    expect(istDate(sub.endDate)).toBe('2027-01-10');
  });

  t('after the offer: regular price, other tiers back on sale, 3 calendar months', async () => {
    clock('2027-01-11T06:00:00Z');
    const plans = await call(ctrl.getPlans, { body: {} });
    expect(plans.body.launchOffer.active).toBe(false);
    expect(plans.body.plans.premium_plus.price).toBe(2499);
    expect(plans.body.plans.premium_plus.endsOn).toBeNull();
    expect(plans.body.plans.basic_premium).toBeDefined();
    const { sub } = await buy('2027-01-11T06:00:00Z');
    expect(Number(sub.amount)).toBe(2499);
    expect(istDate(sub.endDate)).toBe('2027-04-11');
  });

  t('the plans API names the end date and drops nothing it needs', async () => {
    clock('2026-10-11T06:00:00Z');
    const res = await call(ctrl.getPlans, { body: {} });
    const p = res.body.plans.premium_plus;
    expect(p.price).toBe(1100);
    expect(p.endsOn).toBe(OFFER_END);
    expect(p.duration).toBe('until 10 January 2027');
    expect(p.features).toContain('Full access until 10 January 2027');
    expect(Object.keys(res.body.plans)).toEqual(['free', 'premium_plus']);
    expect(res.body.launchOffer.fixedTerm).toMatchObject({ plansEndOn: OFFER_END, lateBonusMonths: 1 });
  });
});
