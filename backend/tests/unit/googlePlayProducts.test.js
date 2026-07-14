/**
 * Google Play Billing config tests — lock the productId ↔ planType map used by
 * the Android user-choice-billing verify path. Pure config, no DB / no network.
 */

const { GOOGLE_PLAY_PRODUCTS, PAID_PLANS } = require('../../constants/plans');

describe('GOOGLE_PLAY_PRODUCTS', () => {
  it('maps a Play product id to every PAID plan tier', () => {
    const mappedTiers = Object.values(GOOGLE_PLAY_PRODUCTS);
    for (const plan of PAID_PLANS) {
      expect(mappedTiers).toContain(plan);
    }
  });

  it('every product id is namespaced tricityshadi_* and unique', () => {
    const ids = Object.keys(GOOGLE_PLAY_PRODUCTS);
    ids.forEach((id) => expect(id).toMatch(/^tricityshadi_/));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves free/unknown products to nothing (no accidental grant)', () => {
    expect(GOOGLE_PLAY_PRODUCTS.tricityshadi_free).toBeUndefined();
    expect(GOOGLE_PLAY_PRODUCTS.some_random_sku).toBeUndefined();
  });
});
