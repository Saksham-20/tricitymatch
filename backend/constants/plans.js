'use strict';

/**
 * Single source of truth for subscription plan tiers.
 *
 * The enum KEYS never change (they are persisted in the Postgres
 * `enum_Subscriptions_planType` type and hardcoded across the codebase);
 * prices/labels/durations are remapped in `utils/razorpay.js` (PLANS) instead.
 *
 * `elite` and `nri` are added by migration 000044. `nri` sits outside the
 * linear upgrade ladder but carries the same capability caps as `vip`
 * (unlimited unlocks + boost + verified), so it shares vip's TIER_RANK.
 * `founding_premium` is added by migration 000048 (Phase S).
 */

// The founding-member grant (Phase S). Paid-GRADE entitlement, zero price:
// granted at signup while the founding window is open (utils/foundingGrant.js),
// never sold. It is in PAID_PLANS (so every premium gate honours it) but NOT in
// PURCHASABLE_PLANS (so create-order rejects it at validation) and NOT in
// UNLIMITED_PLANS (so it gets neither boost nor unlimited unlocks).
const FOUNDING_PLAN = 'founding_premium';

// Contact unlocks bundled with the founding grant — basic_premium-grade.
// MUST be a finite number and MUST be written explicitly on the granted row:
// `Subscription.contactUnlocksAllowed = NULL` means UNLIMITED
// (`middlewares/auth.js` checkContactUnlockLimit), so a grant that left the
// column at its default would hand every self-signup unlimited contact
// unlocks — a scriptable phone-number harvest.
const FOUNDING_CONTACT_UNLOCKS = 5;

// Every paying/paid-grade tier. Used for `requirePremium` and any "is this a
// paid member" gate. Adding a tier here automatically extends all those gates.
// Ordered by TIER_RANK ascending — founding_premium is rank 0 (a free premium
// period, not a rung above free on the money ladder).
const PAID_PLANS = [FOUNDING_PLAN, 'basic_premium', 'premium_plus', 'elite', 'vip', 'nri'];

// Tiers a member may BUY. Feeds `createOrderValidation` and createOrder's own
// guard, so POST /subscription/create-order {planType:'founding_premium'} is a
// 400 at validation and never reaches Razorpay. Entitlement gates keep reading
// PAID_PLANS — the two lists differ ONLY by the granted tier.
const PURCHASABLE_PLANS = ['basic_premium', 'premium_plus', 'elite', 'vip', 'nri'];

// Tiers with unlimited contact unlocks + boost + always-verified.
const UNLIMITED_PLANS = ['vip', 'nri'];

// Including the free tier — for validators that accept "any plan".
const ALL_PLANS = ['free', ...PAID_PLANS];

// Ordinal rank for upgrade-gating and "highest plan per user" dedup.
// nri === vip rank (parallel premium, not a step above).
// founding_premium === free rank: a founding member must be able to upgrade to
// ANY paid tier while their grant is active (createOrder only allows a strictly
// higher rank), and no paid tier may ever be "downgraded" into the grant.
const TIER_RANK = {
  free: 0,
  [FOUNDING_PLAN]: 0,
  basic_premium: 1,
  premium_plus: 2,
  elite: 3,
  vip: 4,
  nri: 4,
};

module.exports = {
  PAID_PLANS,
  PURCHASABLE_PLANS,
  UNLIMITED_PLANS,
  ALL_PLANS,
  TIER_RANK,
  FOUNDING_PLAN,
  FOUNDING_CONTACT_UNLOCKS,
};
