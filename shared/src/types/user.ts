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

export interface AuthUser extends User {
  subscriptionPlan: SubscriptionPlanType;
  onboardingComplete: boolean;
}
