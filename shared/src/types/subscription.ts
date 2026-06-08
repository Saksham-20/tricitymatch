export type SubscriptionPlanType = 'free' | 'basic_premium' | 'premium_plus' | 'vip';
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
