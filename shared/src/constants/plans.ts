import type { PlanFeatures, SubscriptionPlanType, UnlockBundle } from '../types/subscription';

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
    label: 'Basic',
    price: 1299,
    mrp: 1999,
    perMonth: 1299,
    durationDays: 30,
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
    price: 2499,
    mrp: 3999,
    perMonth: 833,
    badge: 'Most Popular',
    durationDays: 90,
    contactUnlocks: 15,
    canChat: true,
    canSeeWhoLikedMe: true,
    canMakeVoiceVideoCalls: true,
    canUseAdvancedFilters: true,
    canBoostProfile: false,
    hasRelationshipManager: false,
    interestsLimit: null,
  },
  elite: {
    planType: 'elite',
    label: 'Elite',
    price: 3999,
    mrp: 6999,
    perMonth: 666,
    badge: 'Best Value',
    durationDays: 180,
    contactUnlocks: 30,
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
    label: 'VIP',
    price: 5999,
    mrp: 11999,
    perMonth: 500,
    durationDays: 360,
    contactUnlocks: null,
    canChat: true,
    canSeeWhoLikedMe: true,
    canMakeVoiceVideoCalls: true,
    canUseAdvancedFilters: true,
    canBoostProfile: true,
    hasRelationshipManager: true,
    interestsLimit: null,
  },
  nri: {
    planType: 'nri',
    label: 'NRI Connect',
    price: 9999,
    perMonth: 1666,
    badge: 'NRI',
    durationDays: 180,
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

// Linear upgrade ladder. `nri` sits at the end (parallel premium tier — it has
// every VIP capability, so isPlanAtLeast against any non-nri requirement passes).
export const PLAN_ORDER: SubscriptionPlanType[] = [
  'free', 'basic_premium', 'premium_plus', 'elite', 'vip', 'nri',
];

export const isPlanAtLeast = (userPlan: SubscriptionPlanType, requiredPlan: SubscriptionPlanType): boolean => {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
};

// À-la-carte contact-unlock top-ups (prices in rupees).
export const UNLOCK_BUNDLES: Record<string, UnlockBundle> = {
  bundle_3:  { bundleId: 'bundle_3',  label: '3 Contact Unlocks',  unlocks: 3,  price: 599 },
  bundle_10: { bundleId: 'bundle_10', label: '10 Contact Unlocks', unlocks: 10, price: 1499 },
  bundle_25: { bundleId: 'bundle_25', label: '25 Contact Unlocks', unlocks: 25, price: 2999 },
};
