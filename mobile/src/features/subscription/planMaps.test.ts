/**
 * Plan-enum ripple guard.
 *
 * History: Phase S added `founding_premium` to shared/src/constants/plans.ts.
 * The two exhaustive `Record<SubscriptionPlanType, …>` maps in
 * SubscriptionScreen were never updated, so `mobile tsc` went red — and stayed
 * red across a release, because the `mobile` workspace sat outside the root
 * lint/test gate and nothing anyone ran could fail.
 *
 * tsc catches the literal-object case. It does NOT catch a map declared with an
 * index signature, a `Partial<Record<…>>`, or one built at runtime, and those
 * are exactly the shapes people reach for when a typecheck is inconvenient.
 * These assertions are the belt to tsc's braces: adding a tier without teaching
 * the UI about it fails here regardless of how the map was typed.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { PLANS, PLAN_ORDER, isPlanAtLeast } from '@shared/constants/plans';
import type { SubscriptionPlanType } from '../../types';
import { PLAY_PRODUCT_IDS } from '../../utils/iap';

const ALL_TIERS = Object.keys(PLANS) as SubscriptionPlanType[];

describe('plan enum ripple', () => {
  it('every tier in PLANS is renderable (colour + icon)', () => {
    // Read the source rather than importing the screen: SubscriptionScreen pulls
    // in native-backed modules (razorpay, iap) that do not exist under jest, so
    // importing it to inspect two constant maps would test the mock, not the app.
    const src = readFileSync(join(__dirname, 'SubscriptionScreen.tsx'), 'utf8');

    const mapBody = (name: string) => {
      const start = src.indexOf(`const ${name}`);
      expect(start).toBeGreaterThan(-1);
      // Plain maps end '};', theme factories end '});' — stop at whichever
      // comes first so both shapes stay covered.
      const ends = ['};', '});']
        .map((t) => src.indexOf(t, start))
        .filter((i) => i > -1);
      return src.slice(start, Math.min(...ends));
    };

    // Phase E+F theme sweep: PLAN_COLOUR became the factory makePlanColour(c).
    const colourMap = mapBody('makePlanColour');
    const iconMap = mapBody('PLAN_ICON');

    for (const tier of ALL_TIERS) {
      expect(colourMap).toContain(`${tier}:`);
      expect(iconMap).toContain(`${tier}:`);
    }
  });

  it('PLAN_ORDER lists every purchasable tier and excludes granted ones', () => {
    // founding_premium is granted during the founding window, never sold. If it
    // ever enters PLAN_ORDER the purchase UI renders a ₹0 plan card.
    expect(PLAN_ORDER).not.toContain('founding_premium');

    for (const tier of ALL_TIERS) {
      const plan = PLANS[tier];
      const isGranted = tier === 'founding_premium';
      if (!isGranted) {
        expect(PLAN_ORDER).toContain(tier);
      }
      expect(plan.planType).toBe(tier);
    }
  });

  it('ranks a founding member at least as high as free, never below', () => {
    // Regression: isPlanAtLeast used PLAN_ORDER.indexOf, and founding_premium is
    // deliberately absent from PLAN_ORDER — so indexOf returned -1 and a founding
    // member scored BELOW free, inverting the single gate the grant exists to pass.
    expect(isPlanAtLeast('founding_premium', 'free')).toBe(true);

    // It is still rank 0 on the money ladder, so every paid tier remains an
    // upgrade the member is allowed to buy.
    expect(isPlanAtLeast('founding_premium', 'basic_premium')).toBe(false);
  });

  it('never exposes a granted tier as a Play product', () => {
    // Mirror of the backend assertion in googlePlayProducts.test.js. Both sides
    // have to agree: a buyable SKU pointing at a grant is a paid tier for free.
    expect(PLAY_PRODUCT_IDS.founding_premium).toBeUndefined();
    expect(PLAY_PRODUCT_IDS.free).toBeUndefined();

    for (const id of Object.values(PLAY_PRODUCT_IDS)) {
      // Play product IDs are permanent once created in Play Console.
      expect(id).toMatch(/^tricitymatch_/);
    }
  });
});
