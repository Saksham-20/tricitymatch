import type { Profile } from './profile';
import type { Subscription, SubscriptionPlanType } from './subscription';

export type { Profile, Subscription, SubscriptionPlanType };

// 'bureau' removed 2026-08-19: enum_Users_role never had the value and no
// /bureau routes exist — the type was lying (docs/BUREAU_CHANNEL_MEMO_2026-08-09.md).
export type UserRole = 'user' | 'admin' | 'super_admin' | 'marketing_manager' | 'marketing';
export type UserStatus = 'active' | 'inactive' | 'banned' | 'pending' | 'deleted';

export interface User {
  id: string;
  email: string;
  googleId: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  lastLogin: string | null;
  phoneVerified: boolean;
  referralCodeUsed: string | null;
  referredByMarketingUserId: string | null;
  isBoosted: boolean;
  boostExpiresAt: string | null;
  fcmTokens: string[];
  createdAt: string;
  updatedAt: string;
  // Included via associations
  Profile?: Profile;
  Subscription?: Subscription;
}

/**
 * Server-owned feature flags, returned on the `/auth/me` payload.
 *
 * These must NOT be duplicated as build-time client constants. A flag baked into
 * a bundle drifts from the server the moment it is flipped, and on mobile a
 * stale bundle can sit on a device for weeks — which is exactly how the app and
 * the website came to disagree about whether the same account could chat.
 */
export interface AuthFeatures {
  /** When on, mutual matches can chat without a paid plan. */
  freeChatForMutuals: boolean;
  /** D1: premium first messages grant free receivers a limited reply window. */
  freeReplyWindow?: boolean;
  /** D7: astrologer marketplace visibility (ships dark). */
  astrologerMarketplace?: boolean;
  /** Whether the founding-member window is currently open. */
  foundingOpen: boolean;
  /**
   * Whether THIS member can still take a founding place. Server-decided: the
   * three conditions (window open, never claimed, no active plan) live in three
   * different places, and a client that assembled them itself would offer a
   * Claim button the server 409s.
   */
  canClaimFounding?: boolean;
  /**
   * Contact unlocks each side of an accepted invite receives. 0 = reward off.
   * Read this rather than hardcoding a number in copy — it is env-tunable, and
   * it is served here so an invite card can state the reward without calling
   * /invite/my-link, which mints an invite token as a side effect.
   */
  inviteRewardUnlocks?: number;
}

export interface AuthUser extends User {
  subscriptionPlan: SubscriptionPlanType;
  onboardingComplete: boolean;
  /** Optional: older server builds predate this block. Treat absence as all-false. */
  features?: AuthFeatures;
}
