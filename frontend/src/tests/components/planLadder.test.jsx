/**
 * Three-tier launch ladder — the two client-side ways a withdrawn tier leaks
 * back onto the page. Both of these actually shipped:
 *
 *  1. The card grid fell back to a hardcoded PLAN_CONFIG entry for any tier the
 *     API did not return, which re-rendered a buyable card at the regular price
 *     for a plan create-order refuses.
 *  2. The feature copy hardcoded the "Everything in Elite" chain, so the VIP
 *     card referred to a tier that was no longer on the page.
 */

import { describe, it, expect } from 'vitest';
import { planFeatures } from '../../utils/planFeatures';

describe('feature chain', () => {
  it('names the tier actually shown below this one', () => {
    const vip = planFeatures('vip', false, null, 'Premium');
    expect(vip[0]).toBe('Everything in Premium');
    // The tier it used to hardcode is gone from the page entirely.
    expect(vip.join(' ')).not.toContain('Elite');
  });

  it('falls back to Free when every tier below has been withdrawn', () => {
    expect(planFeatures('vip', false, null, null)[0]).toBe('Everything in Free');
  });

  it('re-terms the unlock and validity lines off the live plan', () => {
    const live = { contactUnlocks: 30, duration: '3 months', durationDays: 90 };
    const list = planFeatures('premium_plus', false, live, 'Basic');
    expect(list).toContain('30 contact unlocks');
    // Nothing may still claim the pre-offer cap.
    expect(list.join(' ')).not.toContain('15 contact unlocks');
  });

  it('renders unlimited rather than the API sentinel', () => {
    const list = planFeatures('vip', false, { contactUnlocks: -1, durationDays: 180 }, 'Premium');
    expect(list.join(' ')).toContain('Unlimited contact unlocks');
    expect(list.join(' ')).not.toContain('-1');
  });
});
