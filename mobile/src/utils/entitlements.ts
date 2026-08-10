import type { AuthUser } from '../types';

/**
 * Client-side entitlement checks.
 *
 * THE SERVER IS THE ENFORCER. `backend/utils/entitlements.js` decides whether a
 * request is allowed and fails closed on a database error; everything here is
 * display gating — deciding whether to render a paywall or a chat list, not
 * whether data may be read. Never treat a `true` from this file as permission.
 *
 * It exists because the app previously gated chat on `plan !== 'free'` while the
 * server derived it from a feature flag. With FREE_CHAT_FOR_MUTUALS on, the same
 * member could chat on the website and was refused in the app — same account,
 * same backend, two different answers, because the rule was written twice.
 *
 * Mirrors backend/utils/entitlements.js:hasChatAccess. If that changes, change
 * this in the same commit; entitlementsRule.test.ts pins the truth table.
 */

const PAID_PLANS = ['founding_premium', 'basic_premium', 'premium_plus', 'elite', 'vip', 'nri'] as const;

export type ChatAccessReason =
  | 'paid'
  | 'free_chat_flag'
  | 'free_chat_mutual'
  | 'premium_required'
  | 'not_mutual';

export interface ChatAccess {
  allowed: boolean;
  reason: ChatAccessReason;
}

const hasPaidPlan = (user: AuthUser | null): boolean =>
  !!user && (PAID_PLANS as readonly string[]).includes(user.subscriptionPlan);

/**
 * @param isMutual pass when the answer is known for a SPECIFIC conversation.
 *   Omit for a list-level check ("should the Chat tab be usable at all"), which
 *   mirrors the server calling hasChatAccess without an `otherUserId`.
 */
export const hasChatAccess = (user: AuthUser | null, isMutual?: boolean): ChatAccess => {
  if (hasPaidPlan(user)) return { allowed: true, reason: 'paid' };

  // Absent `features` means an older server build that predates the block. Treat
  // it as flag-off: refusing to show a chat list is recoverable, wrongly showing
  // one the server will 403 is a broken screen.
  const freeChatForMutuals = user?.features?.freeChatForMutuals ?? false;
  if (!freeChatForMutuals) return { allowed: false, reason: 'premium_required' };

  if (isMutual === undefined) return { allowed: true, reason: 'free_chat_flag' };

  return isMutual
    ? { allowed: true, reason: 'free_chat_mutual' }
    : { allowed: false, reason: 'not_mutual' };
};

/** Convenience for render-time gating. */
export const canUseChat = (user: AuthUser | null, isMutual?: boolean): boolean =>
  hasChatAccess(user, isMutual).allowed;

/**
 * Premium surfaces OTHER than chat — likes-you, profile viewers, contact unlocks,
 * calls, the kundli PDF. These are gated by `requirePremium` on the server, which
 * deliberately does NOT know about the free-chat flag: the flag opens chat only.
 */
export const hasPremiumAccess = (user: AuthUser | null): boolean => hasPaidPlan(user);
