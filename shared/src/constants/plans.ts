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
  // Founding-member grant (Phase S). Never sold — `price: 0` and deliberately
  // absent from PLAN_ORDER, so it can never render as a purchasable card.
  // Capabilities mirror basic_premium exactly (including 5 contact unlocks:
  // the backend writes that number explicitly on the granted row because a
  // null there would mean UNLIMITED).
  founding_premium: {
    planType: 'founding_premium',
    label: 'Founding Premium',
    price: 0,
    durationDays: null,
    contactUnlocks: 5,
    canChat: true,
    canSeeWhoLikedMe: true,
    canMakeVoiceVideoCalls: false,
    canUseAdvancedFilters: false,
    canBoostProfile: false,
    hasRelationshipManager: false,
    interestsLimit: null,
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
    perMonth: 667,
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
    perMonth: 1667,
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

// Linear upgrade ladder AND the purchase-UI enumeration (mobile maps over it to
// render plan cards). `nri` sits at the end (parallel premium tier — it has
// every VIP capability, so isPlanAtLeast against any non-nri requirement passes).
// `founding_premium` is deliberately EXCLUDED: it is granted, never purchasable,
// and listing it here would render a ₹0 plan card. Read its capabilities from
// PLANS directly rather than through isPlanAtLeast.
export const PLAN_ORDER: SubscriptionPlanType[] = [
  'free', 'basic_premium', 'premium_plus', 'elite', 'vip', 'nri',
];

// Rank on the money ladder, mirroring backend/constants/plans.js TIER_RANK.
// Read through this rather than PLAN_ORDER.indexOf: founding_premium is absent
// from PLAN_ORDER (it must never render as a purchasable card), so indexOf
// returns -1 and a founding member would score BELOW free — inverting the one
// gate the grant exists to pass. Backend puts founding at rank 0 alongside free
// so the member can still upgrade to any paid tier while the grant is active.
const PLAN_RANK: Record<SubscriptionPlanType, number> = {
  free: 0,
  founding_premium: 0,
  basic_premium: 1,
  premium_plus: 2,
  elite: 3,
  vip: 4,
  nri: 4,
};

export const isPlanAtLeast = (userPlan: SubscriptionPlanType, requiredPlan: SubscriptionPlanType): boolean => {
  return PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan];
};

// À-la-carte contact-unlock top-ups (prices in rupees).
export const UNLOCK_BUNDLES: Record<string, UnlockBundle> = {
  bundle_3:  { bundleId: 'bundle_3',  label: '3 Contact Unlocks',  unlocks: 3,  price: 599 },
  bundle_10: { bundleId: 'bundle_10', label: '10 Contact Unlocks', unlocks: 10, price: 1499 },
  bundle_25: { bundleId: 'bundle_25', label: '25 Contact Unlocks', unlocks: 25, price: 3499 },
};
