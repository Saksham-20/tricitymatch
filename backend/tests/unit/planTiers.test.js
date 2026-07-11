/**
 * Pricing-revamp config tests — lock in the new tier ladder, the à-la-carte
 * unlock bundles, and the centralized plan-list constants. Pure config, no DB.
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'test_secret_key', keyId: 'rzp_test_xxx', isConfigured: () => false },
}));

const { PLANS, UNLOCK_BUNDLES, createBundleOrder, getBundleDetails } = require('../../utils/razorpay');
const { PAID_PLANS, UNLIMITED_PLANS, ALL_PLANS, TIER_RANK } = require('../../constants/plans');

describe('plan constants', () => {
  it('PAID_PLANS covers all five paid tiers in ladder order', () => {
    expect(PAID_PLANS).toEqual(['basic_premium', 'premium_plus', 'elite', 'vip', 'nri']);
  });

  it('UNLIMITED_PLANS are vip + nri only', () => {
    expect(UNLIMITED_PLANS).toEqual(['vip', 'nri']);
  });

  it('ALL_PLANS prepends free', () => {
    expect(ALL_PLANS[0]).toBe('free');
    expect(ALL_PLANS).toHaveLength(6);
  });

  it('TIER_RANK ranks nri === vip and is strictly increasing up to that', () => {
    expect(TIER_RANK.free).toBe(0);
    expect(TIER_RANK.basic_premium).toBeLessThan(TIER_RANK.premium_plus);
    expect(TIER_RANK.premium_plus).toBeLessThan(TIER_RANK.elite);
    expect(TIER_RANK.elite).toBeLessThan(TIER_RANK.vip);
    expect(TIER_RANK.nri).toBe(TIER_RANK.vip);
  });
});

describe('razorpay PLANS ladder', () => {
  const expected = {
    basic_premium: { amount: 129900, duration: 30,  contactUnlocks: 5 },
    premium_plus:  { amount: 249900, duration: 90,  contactUnlocks: 15 },
    elite:         { amount: 399900, duration: 180, contactUnlocks: 30 },
    vip:           { amount: 599900, duration: 360, contactUnlocks: null },
    nri:           { amount: 999900, duration: 180, contactUnlocks: null },
  };

  it.each(Object.entries(expected))('%s has the correct price/tenure/unlocks', (key, exp) => {
    const p = PLANS[key];
    expect(p).toBeDefined();
    expect(p.amount).toBe(exp.amount);
    expect(p.duration).toBe(exp.duration);
    expect(p.contactUnlocks).toBe(exp.contactUnlocks);
  });

  it('every paid MRP (when present) is above its price', () => {
    for (const key of PAID_PLANS) {
      const p = PLANS[key];
      if (p.mrp != null) expect(p.mrp).toBeGreaterThan(p.amount);
    }
  });
});

describe('unlock bundles', () => {
  it('exposes three bundles priced above every finite plan per-unlock rate', () => {
    expect(Object.keys(UNLOCK_BUNDLES)).toEqual(['bundle_3', 'bundle_10', 'bundle_25']);
    // Elite is the cheapest per-unlock finite plan (3999/30 = ₹133.3). Every
    // bundle's per-unlock price must stay above that so upgrading wins.
    const bestPlanPerUnlock = (PLANS.elite.amount / 100) / PLANS.elite.contactUnlocks;
    for (const b of Object.values(UNLOCK_BUNDLES)) {
      const perUnlock = (b.amount / 100) / b.unlocks;
      expect(perUnlock).toBeGreaterThan(bestPlanPerUnlock);
    }
  });

  it('getBundleDetails returns the bundle or null', () => {
    expect(getBundleDetails('bundle_10')).toMatchObject({ unlocks: 10 });
    expect(getBundleDetails('nope')).toBeNull();
  });

  it('createBundleOrder rejects an unknown bundle id', async () => {
    await expect(createBundleOrder('bundle_999', 'user-1')).rejects.toThrow('Invalid bundle id');
  });
});
