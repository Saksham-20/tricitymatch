/**
 * Entitlement truth table.
 *
 * Pins the client rule against the server's, case for case. The bug this guards
 * was not a typo — the rule was simply written twice, once in
 * `backend/utils/entitlements.js` and once as `plan !== 'free'` in two screens.
 * With FREE_CHAT_FOR_MUTUALS on, the same member could chat on the website and
 * was refused in the app.
 *
 * Every row below corresponds to a branch of `hasChatAccess` in
 * backend/utils/entitlements.js. When that function changes, this table must be
 * updated in the same commit — that is the entire point of it.
 */

import { hasChatAccess, canUseChat, hasPremiumAccess } from './entitlements';
import type { AuthUser } from '../types';

const user = (plan: string, freeChatForMutuals = false): AuthUser =>
  ({
    id: 'u1',
    subscriptionPlan: plan,
    onboardingComplete: true,
    features: { freeChatForMutuals, foundingOpen: false },
  }) as unknown as AuthUser;

describe('hasChatAccess — mirrors backend/utils/entitlements.js', () => {
  describe('paid plans always pass, flag irrelevant', () => {
    // founding_premium is a GRANT, not a purchase, but it is paid-GRADE and sits
    // in the server's PAID_PLANS — so it must pass every premium gate.
    for (const plan of ['founding_premium', 'basic_premium', 'premium_plus', 'elite', 'vip', 'nri']) {
      it(`${plan} → allowed (reason: paid)`, () => {
        expect(hasChatAccess(user(plan, false))).toEqual({ allowed: true, reason: 'paid' });
        expect(hasChatAccess(user(plan, true))).toEqual({ allowed: true, reason: 'paid' });
      });
    }
  });

  describe('free plan, flag OFF', () => {
    it('is refused regardless of mutual status', () => {
      expect(hasChatAccess(user('free', false))).toEqual({ allowed: false, reason: 'premium_required' });
      expect(hasChatAccess(user('free', false), true)).toEqual({ allowed: false, reason: 'premium_required' });
      expect(hasChatAccess(user('free', false), false)).toEqual({ allowed: false, reason: 'premium_required' });
    });
  });

  describe('free plan, flag ON', () => {
    it('allows the list-level check (server: no otherUserId)', () => {
      expect(hasChatAccess(user('free', true))).toEqual({ allowed: true, reason: 'free_chat_flag' });
    });

    it('allows a mutual conversation', () => {
      expect(hasChatAccess(user('free', true), true)).toEqual({ allowed: true, reason: 'free_chat_mutual' });
    });

    it('refuses a non-mutual conversation', () => {
      expect(hasChatAccess(user('free', true), false)).toEqual({ allowed: false, reason: 'not_mutual' });
    });
  });

  describe('degraded inputs fail CLOSED', () => {
    it('no user at all', () => {
      expect(hasChatAccess(null)).toEqual({ allowed: false, reason: 'premium_required' });
    });

    it('server build with no features block is treated as flag-off', () => {
      // Refusing to show a chat list is recoverable. Showing one the server will
      // 403 is a broken screen the member cannot get out of.
      const legacy = { id: 'u1', subscriptionPlan: 'free', onboardingComplete: true } as unknown as AuthUser;
      expect(hasChatAccess(legacy)).toEqual({ allowed: false, reason: 'premium_required' });
    });

    it('an unrecognised plan string is not treated as paid', () => {
      const bogus = user('enterprise_ultra');
      expect(hasChatAccess(bogus).allowed).toBe(false);
    });
  });
});

describe('hasPremiumAccess — the flag must NOT leak past chat', () => {
  // The server's requirePremium deliberately does not consult the free-chat flag:
  // it also guards likes-you, profile viewers, contact unlocks, calls and the
  // kundli PDF. If the flag leaked here, turning on free chat would silently give
  // away every paid surface.
  it('free + flag ON is still not premium', () => {
    expect(hasPremiumAccess(user('free', true))).toBe(false);
    expect(canUseChat(user('free', true))).toBe(true);
  });

  it('paid is premium', () => {
    expect(hasPremiumAccess(user('vip'))).toBe(true);
  });
});
