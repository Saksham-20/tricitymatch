/**
 * Referral settings in the launch-offer blob, and the order amount they produce.
 * (Quote → settle behaviour is in tests/integration/db/referralCheckout.test.js.)
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../models', () => ({ AppSetting: { upsert: jest.fn(async () => {}) } }));

const launchOffer = require('../../utils/launchOffer');
const { getReferralState, saveOffer, OfferValidationError, DEFAULT_REFERRAL, __setCacheForTests } = launchOffer;

afterEach(() => __setCacheForTests(null));

describe('getReferralState', () => {
  it('falls back to the defaults when nothing is loaded or the blob predates referrals', () => {
    __setCacheForTests(null);
    expect(getReferralState()).toEqual(DEFAULT_REFERRAL);
    __setCacheForTests({ enabled: true, plans: {} });
    expect(getReferralState()).toEqual(DEFAULT_REFERRAL);
  });

  it('never reads a malformed field as 0 — a bad save cannot make the discount free or the reward unlimited', () => {
    __setCacheForTests({ referral: { enabled: true, discountPaise: 'lots', referrerUnlocks: -4 } });
    expect(getReferralState()).toMatchObject({
      discountPaise: DEFAULT_REFERRAL.discountPaise,
      referrerUnlocks: DEFAULT_REFERRAL.referrerUnlocks,
    });
    __setCacheForTests({ referral: { enabled: true, discountPaise: 99999999, referrerUnlocks: 5000 } });
    expect(getReferralState().discountPaise).toBe(DEFAULT_REFERRAL.discountPaise);
    expect(getReferralState().referrerUnlocks).toBe(DEFAULT_REFERRAL.referrerUnlocks);
  });

  it('honours an explicit off switch and a configured ₹50 discount', () => {
    __setCacheForTests({ referral: { enabled: false, discountPaise: 5000, referrerUnlocks: 2 } });
    expect(getReferralState()).toEqual({ enabled: false, discountPaise: 5000, referrerUnlocks: 2 });
  });
});

describe('saveOffer referral block', () => {
  const base = { plans: { premium_plus: { amount: 109900, duration: 90, contactUnlocks: null } } };

  it('persists a valid referral config', async () => {
    const saved = await saveOffer({ ...base, referral: { enabled: true, discountPaise: 5000, referrerUnlocks: 3 } }, 'admin');
    expect(saved.referral).toEqual({ enabled: true, discountPaise: 5000, referrerUnlocks: 3 });
  });

  it('keeps the existing referral config when a save does not mention it', async () => {
    __setCacheForTests({ enabled: true, plans: base.plans, referral: { enabled: false, discountPaise: 7000, referrerUnlocks: 1 } });
    const saved = await saveOffer({ headline: 'x' }, 'admin');
    expect(saved.referral).toEqual({ enabled: false, discountPaise: 7000, referrerUnlocks: 1 });
  });

  it.each([
    [{ discountPaise: -1 }],
    [{ discountPaise: 100001 }],
    [{ discountPaise: 99.5 }],
    [{ referrerUnlocks: 101 }],
    [{ referrerUnlocks: 2.5 }],
  ])('rejects %j', async (referral) => {
    await expect(saveOffer({ ...base, referral }, 'admin')).rejects.toBeInstanceOf(OfferValidationError);
  });
});

describe('razorpay.createOrder with a referral discount', () => {
  it('charges the plan price minus the discount, and refuses a discount that would zero the order', async () => {
    const create = jest.fn(async (o) => ({ id: 'order_x', amount: o.amount, currency: 'INR', receipt: o.receipt }));
    jest.resetModules();
    jest.doMock('razorpay', () => jest.fn(() => ({ orders: { create } })));
    jest.doMock('../../config/env', () => {
      const real = jest.requireActual('../../config/env');
      return { ...real, razorpay: { ...real.razorpay, keyId: 'rzp_test_x', keySecret: 'secret_x', isConfigured: () => true } };
    });
    const rz = require('../../utils/razorpay');
    const plan = rz.getPlanDetails('premium_plus');

    const order = await rz.createOrder('premium_plus', 'u1', { discountPaise: 10000, referralCode: 'TMABC234' });
    expect(order.amount).toBe(plan.amount - 10000);
    expect(create.mock.calls[0][0].notes).toMatchObject({ referralCode: 'TMABC234', discountPaise: '10000' });

    await expect(rz.createOrder('premium_plus', 'u1', { discountPaise: plan.amount })).rejects.toThrow('Invalid discount');
    const plain = await rz.createOrder('premium_plus', 'u1');
    expect(plain.amount).toBe(plan.amount);
  });
});
