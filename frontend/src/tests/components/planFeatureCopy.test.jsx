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
  it.each([false, true])('higher tiers are untouched (flag=%s)', (flag) => {
    expect(planFeatures('premium_plus', flag)[0]).toBe('Everything in Basic');
    expect(planFeatures('elite', flag)[0]).toBe('Everything in Premium');
    expect(planFeatures('vip', flag)[0]).toBe('Everything in Elite');
    expect(planFeatures('nri', flag)[0]).toBe('Everything in VIP');
  });
});

describe('unknown tier', () => {
  it('is an empty list, not a crash', () => {
    expect(planFeatures('does_not_exist', true)).toEqual([]);
  });
});
