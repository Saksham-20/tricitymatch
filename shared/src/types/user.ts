import type { Profile } from './profile';
import type { Subscription, SubscriptionPlanType } from './subscription';

export type { Profile, Subscription, SubscriptionPlanType };

export type UserRole = 'user' | 'admin' | 'super_admin' | 'marketing_manager' | 'marketing' | 'bureau';
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
  /** Whether the founding-member window is currently open. */
  foundingOpen: boolean;
}

export interface AuthUser extends User {
  subscriptionPlan: SubscriptionPlanType;
  onboardingComplete: boolean;
  /** Optional: older server builds predate this block. Treat absence as all-false. */
  features?: AuthFeatures;
}
