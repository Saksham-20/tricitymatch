/**
 * Launch-offer pricing layer.
 *
 * The invariant under test: what a member is CHARGED (createOrder →
 * getPlanDetails) and what a member is SHOWN (getPlans → getPlanDetails) come
 * from one resolved read, and the layer fails closed to REGULAR pricing —
 * never to free, never to unlimited unlocks.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const launchOffer = require('../../utils/launchOffer');
const { __setCacheForTests, overlayPlan, overlayBundle, isOfferActive, getFoundingState } = launchOffer;
const { PLANS, UNLOCK_BUNDLES, getPlanDetails, getBundleDetails } = require('../../utils/razorpay');

const futureIso = () => new Date(Date.now() + 30 * 86400000).toISOString();
const pastIso = () => new Date(Date.now() - 86400000).toISOString();

const activeOffer = (overrides = {}) => ({
  enabled: true,
  endsAt: futureIso(),
  plans: { vip: { amount: 129900, duration: 180, contactUnlocks: null } },
  bundles: { bundle_3: { amount: 19900 }, bundle_25: { hidden: true } },
  founding: { enabled: true, endsAt: futureIso(), memberCap: 500, grantDays: 30, contactUnlocks: 3 },
  ...overrides,
});

afterEach(() => __setCacheForTests(null));

describe('offer window', () => {
  it('is inactive when nothing has loaded (fail closed to regular pricing)', () => {
    __setCacheForTests(null);
    expect(isOfferActive()).toBe(false);
    expect(getPlanDetails('vip').amount).toBe(PLANS.vip.amount);
  });

  it('is inactive once the deadline passes', () => {
    __setCacheForTests(activeOffer({ endsAt: pastIso() }));
    expect(isOfferActive()).toBe(false);
    expect(getPlanDetails('vip').amount).toBe(PLANS.vip.amount);
  });

  it('is inactive when switched off, even with a live deadline', () => {
    __setCacheForTests(activeOffer({ enabled: false }));
    expect(isOfferActive()).toBe(false);
  });
});

describe('plan overlay', () => {
  it('overrides price, tenure and unlocks for an overridden tier', () => {
    __setCacheForTests(activeOffer());
    const vip = getPlanDetails('vip');
    expect(vip.amount).toBe(129900);
    expect(vip.duration).toBe(180);
    expect(vip.contactUnlocks).toBeNull();
    expect(vip.isLaunchPrice).toBe(true);
    expect(vip.regularAmount).toBe(PLANS.vip.amount);
  });

  it('leaves a tier with no override on regular pricing', () => {
    __setCacheForTests(activeOffer());
    expect(getPlanDetails('elite').amount).toBe(PLANS.elite.amount);
    expect(getPlanDetails('elite').isLaunchPrice).toBeUndefined();
  });

  it('derives the strike-through anchor from the regular price prorated to the launch tenure', () => {
    __setCacheForTests(activeOffer());
    // vip regular 5999 / 360d → 180d ⇒ 2999.5 ≈ 299950 paise
    expect(getPlanDetails('vip').mrp).toBe(Math.round((PLANS.vip.amount * 180) / PLANS.vip.duration));
  });

  it('ignores a malformed override rather than charging a bad amount', () => {
    for (const bad of [{ amount: 0, duration: 30 }, { amount: -100, duration: 30 }, { amount: 9900, duration: 0 }, { amount: 'free', duration: 30 }]) {
      __setCacheForTests(activeOffer({ plans: { vip: bad } }));
      expect(getPlanDetails('vip').amount).toBe(PLANS.vip.amount);
    }
  });

  it('never widens a finite unlock cap on a garbage value', () => {
    __setCacheForTests(activeOffer({
      plans: { basic_premium: { amount: 29900, duration: 30, contactUnlocks: 'lots' } },
    }));
    expect(getPlanDetails('basic_premium').contactUnlocks).toBe(PLANS.basic_premium.contactUnlocks);
  });

  it('returns null for an unknown plan', () => {
    __setCacheForTests(activeOffer());
    expect(getPlanDetails('nope')).toBeNull();
    expect(overlayPlan('nope', null)).toBeNull();
  });
});

describe('bundle overlay', () => {
  it('reprices a bundle and keeps the regular price as the anchor', () => {
    __setCacheForTests(activeOffer());
    const b = getBundleDetails('bundle_3');
    expect(b.amount).toBe(19900);
    expect(b.mrp).toBe(UNLOCK_BUNDLES.bundle_3.amount);
  });

  it('WITHDRAWS a hidden bundle — refused at purchase, not merely un-rendered', async () => {
    __setCacheForTests(activeOffer());
    expect(getBundleDetails('bundle_25')).toBeNull();
    const { createBundleOrder } = require('../../utils/razorpay');
    await expect(createBundleOrder('bundle_25', 'user-1')).rejects.toThrow('Invalid bundle id');
  });

  it('falls back to the regular bundle price when the offer is off', () => {
    __setCacheForTests(null);
    expect(getBundleDetails('bundle_3').amount).toBe(UNLOCK_BUNDLES.bundle_3.amount);
  });
});

describe('founding state', () => {
  it('reads the settings blob when present', () => {
    __setCacheForTests(activeOffer());
    const f = getFoundingState();
    expect(f).toMatchObject({ open: true, memberCap: 500, grantDays: 30, contactUnlocks: 3, source: 'settings' });
  });

  it('closes once the founding deadline passes even while plan pricing stays live', () => {
    __setCacheForTests(activeOffer({
      founding: { enabled: true, endsAt: pastIso(), memberCap: 500, grantDays: 30, contactUnlocks: 3 },
    }));
    expect(isOfferActive()).toBe(true);
    expect(getFoundingState().open).toBe(false);
  });

  it('never reports unlimited founding unlocks (null would mean unlimited downstream)', () => {
    __setCacheForTests(activeOffer({
      founding: { enabled: true, endsAt: futureIso(), memberCap: 500, grantDays: 30, contactUnlocks: null },
    }));
    expect(getFoundingState().contactUnlocks).toBe(3);
  });
});

describe('saveOffer validation', () => {
  const { saveOffer, OfferValidationError } = launchOffer;
  const base = () => ({
    enabled: true,
    endsAt: futureIso(),
    plans: { vip: { amount: 129900, duration: 180, contactUnlocks: null } },
    bundles: {},
    founding: { enabled: true, endsAt: futureIso(), memberCap: 500, grantDays: 30, contactUnlocks: 3 },
  });

  const expectReject = async (patch, re) => {
    await expect(saveOffer(patch, 'admin-1')).rejects.toThrow(re);
    await expect(saveOffer(patch, 'admin-1')).rejects.toBeInstanceOf(OfferValidationError);
  };

  beforeEach(() => __setCacheForTests(base()));

  it('rejects a zero/negative price', async () => {
    await expectReject({ ...base(), plans: { vip: { amount: 0, duration: 30 } } }, /amount/);
  });

  it('rejects an absurd tenure', async () => {
    await expectReject({ ...base(), plans: { vip: { amount: 9900, duration: 5000 } } }, /1–730 days/);
  });

  it('rejects an MRP below the offer price (a negative discount)', async () => {
    await expectReject({ ...base(), plans: { vip: { amount: 129900, duration: 180, mrp: 9900 } } }, /mrp/);
  });

  it('rejects unlimited founding unlocks', async () => {
    await expectReject({ ...base(), founding: { ...base().founding, contactUnlocks: null } }, /contactUnlocks/);
  });

  it('rejects a non-ISO deadline', async () => {
    await expectReject({ ...base(), endsAt: 'next tuesday' }, /ISO date/);
  });
});
