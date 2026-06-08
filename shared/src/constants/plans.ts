import type { PlanFeatures, SubscriptionPlanType } from '../types/subscription';

export const PLANS: Record<SubscriptionPlanType, PlanFeatures> = {
  free: {
    planType: 'free',
    label: 'Free',
    price: 0,
    durationDays: null,
    contactUnlocks: 0,
    canChat: false,
    canSeeWhoLikedMe: false,
    canMakeVoiceVideoCalls: false,
    canUseAdvancedFilters: false,
    canBoostProfile: false,
    hasRelationshipManager: false,
    interestsLimit: 5,
  },
  basic_premium: {
    planType: 'basic_premium',
    label: 'Plus',
    price: 1500,
    durationDays: 15,
    contactUnlocks: 5,
    canChat: true,
    canSeeWhoLikedMe: true,
    canMakeVoiceVideoCalls: false,
    canUseAdvancedFilters: false,
    canBoostProfile: false,
    hasRelationshipManager: false,
    interestsLimit: null,
  },
  premium_plus: {
    planType: 'premium_plus',
    label: 'Premium',
    price: 3000,
    durationDays: 30,
    contactUnlocks: 10,
    canChat: true,
    canSeeWhoLikedMe: true,
    canMakeVoiceVideoCalls: true,
    canUseAdvancedFilters: true,
    canBoostProfile: false,
    hasRelationshipManager: false,
    interestsLimit: null,
  },
  vip: {
    planType: 'vip',
    label: 'Elite',
    price: 7499,
    durationDays: 90,
    contactUnlocks: null,
    canChat: true,
    canSeeWhoLikedMe: true,
    canMakeVoiceVideoCalls: true,
    canUseAdvancedFilters: true,
    canBoostProfile: true,
    hasRelationshipManager: true,
    interestsLimit: null,
  },
};

export const PLAN_ORDER: SubscriptionPlanType[] = ['free', 'basic_premium', 'premium_plus', 'vip'];

export const isPlanAtLeast = (userPlan: SubscriptionPlanType, requiredPlan: SubscriptionPlanType): boolean => {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
};
