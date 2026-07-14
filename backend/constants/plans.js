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
 */

// Every paying tier. Used for `requirePremium` and any "is this a paid member"
// gate. Adding a tier here automatically extends all those gates.
const PAID_PLANS = ['basic_premium', 'premium_plus', 'elite', 'vip', 'nri'];

// Tiers with unlimited contact unlocks + boost + always-verified.
const UNLIMITED_PLANS = ['vip', 'nri'];

// Including the free tier — for validators that accept "any plan".
const ALL_PLANS = ['free', ...PAID_PLANS];

// Ordinal rank for upgrade-gating and "highest plan per user" dedup.
// nri === vip rank (parallel premium, not a step above).
const TIER_RANK = {
  free: 0,
  basic_premium: 1,
  premium_plus: 2,
  elite: 3,
  vip: 4,
  nri: 4,
};

// Google Play subscription product IDs ↔ plan tiers. These IDs must be created
// verbatim as subscription products in Play Console. Kept here so the Android
// receipt-verification path can map a purchased productId back to a plan tier.
// (Mirror map lives in mobile/src/utils/iap.ts.)
const GOOGLE_PLAY_PRODUCTS = {
  tricityshadi_basic_premium: 'basic_premium',
  tricityshadi_premium_plus:  'premium_plus',
  tricityshadi_elite:         'elite',
  tricityshadi_vip:           'vip',
  tricityshadi_nri:           'nri',
};

module.exports = { PAID_PLANS, UNLIMITED_PLANS, ALL_PLANS, TIER_RANK, GOOGLE_PLAY_PRODUCTS };
