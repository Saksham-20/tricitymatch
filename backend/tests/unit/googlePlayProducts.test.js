/**
 * Google Play Billing config tests — lock the productId ↔ planType map used by
 * the Android user-choice-billing verify path. Pure config, no DB / no network.
 */

const {
  GOOGLE_PLAY_PRODUCTS,
  PURCHASABLE_PLANS,
  PAID_PLANS,
  FOUNDING_PLAN,
} = require('../../constants/plans');

describe('GOOGLE_PLAY_PRODUCTS', () => {
  it('maps a Play product id to every PURCHASABLE plan tier', () => {
    // Deliberately PURCHASABLE_PLANS, not PAID_PLANS. Paid includes tiers that
    // are granted rather than sold (founding), and those must never be buyable.
    const mappedTiers = Object.values(GOOGLE_PLAY_PRODUCTS);
    for (const plan of PURCHASABLE_PLANS) {
      expect(mappedTiers).toContain(plan);
    }
  });

  it('never exposes a granted tier as a Play product', () => {
    // founding_premium is awarded during the founding window, not sold. A Play
    // product mapping to it would let anyone buy a grant for the price of the
    // cheapest SKU they could get Google to accept.
    const mappedTiers = Object.values(GOOGLE_PLAY_PRODUCTS);
    expect(mappedTiers).not.toContain(FOUNDING_PLAN);

    const granted = PAID_PLANS.filter((p) => !PURCHASABLE_PLANS.includes(p));
    for (const plan of granted) {
      expect(mappedTiers).not.toContain(plan);
    }
  });

  it('every product id is namespaced tricitymatch_* and unique', () => {
    // Play product IDs are permanent once created in Play Console — they cannot
    // be renamed or reused. The namespace has to be right BEFORE anyone creates
    // them, which is why this is pinned rather than left as a convention.
    const ids = Object.keys(GOOGLE_PLAY_PRODUCTS);
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach((id) => expect(id).toMatch(/^tricitymatch_/));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves free/unknown products to nothing (no accidental grant)', () => {
    expect(GOOGLE_PLAY_PRODUCTS.tricitymatch_free).toBeUndefined();
    expect(GOOGLE_PLAY_PRODUCTS.some_random_sku).toBeUndefined();
  });
});
