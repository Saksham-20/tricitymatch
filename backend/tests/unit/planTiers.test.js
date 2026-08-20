/**
 * Pricing-revamp config tests — lock in the new tier ladder, the à-la-carte
 * unlock bundles, and the centralized plan-list constants. Pure config, no DB.
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'test_secret_key', keyId: 'rzp_test_xxx', isConfigured: () => false },
}));

const { PLANS, UNLOCK_BUNDLES, createBundleOrder, getBundleDetails } = require('../../utils/razorpay');
const {
  PAID_PLANS,
  PURCHASABLE_PLANS,
  UNLIMITED_PLANS,
  ALL_PLANS,
  TIER_RANK,
  FOUNDING_PLAN,
  FOUNDING_CONTACT_UNLOCKS,
} = require('../../constants/plans');

describe('plan constants', () => {
  it('PAID_PLANS covers every paid-grade tier in ladder order', () => {
    expect(PAID_PLANS).toEqual([
      'founding_premium', 'basic_premium', 'premium_plus', 'elite', 'vip', 'nri',
    ]);
  });

  it('UNLIMITED_PLANS are vip + nri only', () => {
    expect(UNLIMITED_PLANS).toEqual(['vip', 'nri']);
  });

  it('ALL_PLANS prepends free', () => {
    expect(ALL_PLANS[0]).toBe('free');
    expect(ALL_PLANS).toHaveLength(7);
  });

  it('TIER_RANK ranks nri === vip and is strictly increasing up to that', () => {
    expect(TIER_RANK.free).toBe(0);
    expect(TIER_RANK.basic_premium).toBeLessThan(TIER_RANK.premium_plus);
    expect(TIER_RANK.premium_plus).toBeLessThan(TIER_RANK.elite);
    expect(TIER_RANK.elite).toBeLessThan(TIER_RANK.vip);
    expect(TIER_RANK.nri).toBe(TIER_RANK.vip);
  });
});

// The founding tier's whole safety story is which list it is in and which it is
// NOT. Each of these, if it flipped, is a different production incident.
describe('founding_premium tier placement', () => {
  it('is a PAID-grade entitlement (every premium gate reads PAID_PLANS)', () => {
    expect(PAID_PLANS).toContain(FOUNDING_PLAN);
  });

  it('is NOT purchasable — create-order must reject it before Razorpay', () => {
    expect(PURCHASABLE_PLANS).not.toContain(FOUNDING_PLAN);
  });

  it('PURCHASABLE_PLANS is exactly PAID_PLANS minus the granted tier', () => {
    expect(PURCHASABLE_PLANS).toEqual(PAID_PLANS.filter((p) => p !== FOUNDING_PLAN));
  });

  it('is NOT unlimited — unlimited would mean unlimited contact unlocks + boost', () => {
    expect(UNLIMITED_PLANS).not.toContain(FOUNDING_PLAN);
  });

  it('ranks at 0 so a founding member can still upgrade to any paid tier', () => {
    expect(TIER_RANK[FOUNDING_PLAN]).toBe(0);
    expect(TIER_RANK[FOUNDING_PLAN]).toBeLessThan(TIER_RANK.basic_premium);
  });

  it('bundles a FINITE contact-unlock allowance (NULL would mean unlimited)', () => {
    expect(typeof FOUNDING_CONTACT_UNLOCKS).toBe('number');
    // Default fallback; the live value is admin-editable (utils/launchOffer.js).
    expect(FOUNDING_CONTACT_UNLOCKS).toBe(3);
  });

  it('has no entry in the razorpay price map (it is granted, never priced)', () => {
    expect(PLANS[FOUNDING_PLAN]).toBeUndefined();
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

  it('every purchasable MRP (when present) is above its price', () => {
    // PURCHASABLE_PLANS, not PAID_PLANS: founding_premium is paid-grade for
    // entitlement gates but has no razorpay catalog entry — it is granted, never sold.
    for (const key of PURCHASABLE_PLANS) {
      const p = PLANS[key];
      expect(p).toBeDefined();
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
