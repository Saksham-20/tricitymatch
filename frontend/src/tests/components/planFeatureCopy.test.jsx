/**
 * Plan copy vs the FREE_CHAT_FOR_MUTUALS flag (Phase 2).
 *
 * The failure this prevents is a pricing lie in either direction: with the flag
 * ON, selling "Unlimited messages" as a Basic feature charges for something
 * every free member already has; with it OFF, listing chat under Free promises
 * something the server 403s. The copy is therefore derived from the server flag
 * (`/auth/me` → `features.freeChatForMutuals`), and this locks that derivation.
 */
import { describe, it, expect } from 'vitest';
import { planFeatures } from '../../utils/planFeatures';

const CHAT_LINE = 'Chat with your mutual matches';
const PAID_CHAT_LINE = 'Unlimited messages';

describe('flag OFF (shipped default — chat is a paid feature)', () => {
  it('Free does not promise chat', () => {
    expect(planFeatures('free', false)).not.toContain(CHAT_LINE);
  });

  it('Basic still sells messaging', () => {
    expect(planFeatures('basic_premium', false)).toContain(PAID_CHAT_LINE);
  });
});

describe('flag ON (free members message their mutual matches)', () => {
  it('Free gains the chat line', () => {
    expect(planFeatures('free', true)).toContain(CHAT_LINE);
  });

  it('Basic stops charging for messaging', () => {
    expect(planFeatures('basic_premium', true)).not.toContain(PAID_CHAT_LINE);
  });

  it('Basic re-leads on what it still uniquely buys', () => {
    const basic = planFeatures('basic_premium', true);
    expect(basic[0]).toBe('View contact details');
    expect(basic).toContain('See who viewed profile');
    expect(basic).toContain('5 contact unlocks');
  });
});

describe('the "Everything in X" chains stay valid in both worlds', () => {
  // The chain names the tier RENDERED below this one, passed in by the caller —
  // it is no longer baked into the copy. The launch offer can withdraw a tier,
  // and a card that referred to a plan absent from the page (which is what
  // "Everything in Elite" became) points the reader at nothing.
  it.each([false, true])('higher tiers chain off the tier shown below them (flag=%s)', (flag) => {
    expect(planFeatures('premium_plus', flag, null, 'Basic')[0]).toBe('Everything in Basic');
    expect(planFeatures('elite', flag, null, 'Premium')[0]).toBe('Everything in Premium');
    expect(planFeatures('vip', flag, null, 'Premium')[0]).toBe('Everything in Premium');
    expect(planFeatures('nri', flag, null, 'VIP')[0]).toBe('Everything in VIP');
  });

  it.each([false, true])('falls back to Free when nothing is shown below (flag=%s)', (flag) => {
    expect(planFeatures('vip', flag)[0]).toBe('Everything in Free');
  });
});

describe('unknown tier', () => {
  it('is an empty list, not a crash', () => {
    expect(planFeatures('does_not_exist', true)).toEqual([]);
  });
});

/**
 * Launch offer re-terms plans at runtime (price, tenure, unlock cap), so the
 * card copy must follow the live plan rather than the frozen strings. A stale
 * "5 contact unlocks" beside a plan the server sells with 6 is a false claim on
 * the buy button.
 */
describe('feature copy follows the live plan', () => {
  it('rewrites the unlock line from the live plan', () => {
    const copy = planFeatures('basic_premium', false, { contactUnlocks: 6, duration: '1 month' });
    expect(copy).toContain('6 contact unlocks');
    expect(copy).not.toContain('5 contact unlocks');
  });

  it('renders -1 as unlimited', () => {
    expect(planFeatures('elite', false, { contactUnlocks: -1, duration: '4 months' }))
      .toContain('Unlimited contact unlocks');
  });

  it('rewrites the validity claim to the live tenure', () => {
    const copy = planFeatures('vip', false, { contactUnlocks: -1, duration: '6 months' });
    expect(copy).toContain('6 months of full access');
    expect(copy).not.toContain('Full-year validity');
  });

  it('leaves copy untouched when no live plan is supplied', () => {
    expect(planFeatures('basic_premium', false)).toContain('5 contact unlocks');
  });
});

/**
 * Every line on a plan card must be something the product does. Search filters
 * are not gated, and nothing delivers a spotlight listing, priority support, a
 * relationship advisor, timezone matching or a plan-granted verified badge.
 */
describe('no claim the product does not deliver', () => {
  const NOT_DELIVERED = [
    'Advanced search filters',
    'Spotlight listing',
    'Priority customer support',
    'Dedicated relationship advisor',
    'Priority NRI support',
    'Timezone-aware matching',
    'Verified badge',
  ];

  it.each(['free', 'basic_premium', 'premium_plus', 'elite', 'vip', 'nri'])('%s', (tier) => {
    for (const flag of [false, true]) {
      for (const prev of [null, 'Basic', 'Premium']) {
        const copy = planFeatures(tier, flag, null, prev);
        for (const claim of NOT_DELIVERED) expect(copy).not.toContain(claim);
      }
    }
  });

  it('free says what is true: every search filter is free', () => {
    expect(planFeatures('free', false)).toContain('All search filters');
  });
});

/**
 * With Basic withdrawn (the single-plan launch page), Premium chains off Free.
 * "Everything in Free" alone would hide what Premium adds, so the paid basics
 * are spelled out — and never twice when Basic is on the page.
 */
describe('a tier chained off Free spells out the paid basics', () => {
  it('Premium chained off Free lists contact details and who viewed you (flag on)', () => {
    const copy = planFeatures('premium_plus', true, { contactUnlocks: -1, duration: '3 months' }, 'Free');
    expect(copy[0]).toBe('Everything in Free');
    expect(copy).toContain('View contact details');
    expect(copy).toContain('See who viewed profile');
    expect(copy).toContain('Unlimited contact unlocks');
    expect(copy).not.toContain('5 contact unlocks');
    expect(copy).not.toContain('Unlimited messages');
  });

  it('with the flag off the paid basics include messaging', () => {
    expect(planFeatures('premium_plus', false, null, null)).toContain('Unlimited messages');
  });

  it('chained off Basic, nothing is repeated', () => {
    const copy = planFeatures('premium_plus', false, null, 'Basic');
    expect(copy[0]).toBe('Everything in Basic');
    expect(copy).not.toContain('View contact details');
    expect(copy).not.toContain('See who viewed profile');
  });
});
