/**
 * Tier withdrawal (three-tier launch ladder).
 *
 * The launch offer can take a tier OFF SALE. Two things must both hold, and
 * they pull in opposite directions:
 *
 *   1. Nobody can BUY it — not through the UI (no card) and not through a
 *      hand-crafted or stale-client request (create-order refuses).
 *   2. It still RESOLVES for anyone already holding it — my-subscription,
 *      invoices, the webhook and admin grants must keep working, or hiding a
 *      tier would silently break every member on it.
 *
 * Returning null from getPlanDetails would satisfy (1) and break (2), which is
 * why a withdrawn tier resolves to the regular plan carrying `hidden: true`.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { __setCacheForTests } = require('../../utils/launchOffer');
const { PLANS, getPlanDetails, isPlanPurchasable, createOrder } = require('../../utils/razorpay');

const futureIso = () => new Date(Date.now() + 30 * 86400000).toISOString();

const offerWith = (plans) => ({
  enabled: true,
  endsAt: futureIso(),
  plans,
  bundles: {},
  founding: { enabled: false, endsAt: null, memberCap: 0, grantDays: 30, contactUnlocks: 3 },
});

afterEach(() => __setCacheForTests(null));

describe('a withdrawn tier', () => {
  beforeEach(() => {
    __setCacheForTests(offerWith({
      elite: { hidden: true },
      vip: { amount: 129900, duration: 180, contactUnlocks: null },
    }));
  });

  it('is not purchasable', () => {
    expect(isPlanPurchasable('elite')).toBe(false);
  });

  it('still resolves, at the REGULAR price, for members already holding it', () => {
    const elite = getPlanDetails('elite');
    expect(elite).not.toBeNull();
    expect(elite.amount).toBe(PLANS.elite.amount);
    expect(elite.duration).toBe(PLANS.elite.duration);
    // No launch pricing is claimed for a tier that is not on sale.
    expect(elite.isLaunchPrice).toBeUndefined();
    expect(elite.hidden).toBe(true);
  });

  it('is refused at checkout, not merely hidden in the UI', async () => {
    await expect(createOrder('elite', 'user-1')).rejects.toThrow('Invalid plan type');
  });

  it('leaves every other tier purchasable and launch-priced', () => {
    expect(isPlanPurchasable('vip')).toBe(true);
    const vip = getPlanDetails('vip');
    expect(vip.amount).toBe(129900);
    expect(vip.hidden).toBeUndefined();
  });
});

describe('when no offer is running', () => {
  it('every tier is purchasable again — withdrawal is scoped to the offer window', () => {
    __setCacheForTests(null);
    expect(isPlanPurchasable('elite')).toBe(true);
    expect(getPlanDetails('elite').hidden).toBeUndefined();
  });

  it('an unknown tier is still not purchasable', () => {
    __setCacheForTests(null);
    expect(isPlanPurchasable('nope')).toBe(false);
    expect(getPlanDetails('nope')).toBeNull();
  });
});
