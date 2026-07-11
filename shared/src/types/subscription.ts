export type SubscriptionPlanType = 'free' | 'basic_premium' | 'premium_plus' | 'elite' | 'vip' | 'nri';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface Subscription {
  id: string;
  userId: string;
  planType: SubscriptionPlanType;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  amount: number | null;
  status: SubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
  contactUnlocksAllowed: number | null;
  contactUnlocksUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanFeatures {
  planType: SubscriptionPlanType;
  label: string;
  price: number;
  /** Anchor "was" price for strike-through display (rupees). */
  mrp?: number;
  /** Effective per-month price (rupees, rounded) for the "₹X/month" line. */
  perMonth?: number;
  /** Presentation badge, e.g. "Most Popular" / "Best Value" / "NRI". */
  badge?: string;
  durationDays: number | null;
  contactUnlocks: number | null;
  canChat: boolean;
  canSeeWhoLikedMe: boolean;
  canMakeVoiceVideoCalls: boolean;
  canUseAdvancedFilters: boolean;
  canBoostProfile: boolean;
  hasRelationshipManager: boolean;
  interestsLimit: number | null;
}

export type UnlockBundleId = 'bundle_3' | 'bundle_10' | 'bundle_25';

export interface UnlockBundle {
  bundleId: UnlockBundleId;
  label: string;
  unlocks: number;
  /** Price in rupees. */
  price: number;
}
