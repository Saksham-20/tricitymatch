// ─── Plan feature lists ───────────────────────
// The chat lines are DERIVED from the server's `freeChatForMutuals` flag, never
// hardcoded: with the flag on, "Unlimited messages" as a paid feature is a lie
// (free members message their mutual matches), and with it off, promising free
// chat is a lie in the other direction. `planFeatures()` below is the only
// place either line is written.
const PLAN_FEATURES = {
  free: [
    'Create profile',
    'Browse matches',
    'Send interest',
    'Basic search filters',
  ],
  basic_premium: [
    'View contact details',
    'Unlimited messages',
    'See who viewed profile',
    'Advanced search filters',
    '5 contact unlocks',
  ],
  premium_plus: [
    'Everything in Basic',
    '15 contact unlocks',
    'Profile boost',
    'Spotlight listing',
    'Priority customer support',
  ],
  elite: [
    'Everything in Premium',
    '30 contact unlocks',
    'Priority ranking in search',
    '6-month validity',
    'Best value per month',
  ],
  vip: [
    'Everything in Elite',
    'Unlimited contact unlocks',
    'Verified badge',
    'Full-year validity',
    'Dedicated relationship advisor',
  ],
  nri: [
    'Everything in VIP',
    'Unlimited contact unlocks',
    'Priority NRI support',
    'Timezone-aware matching',
    'Prices in your local currency',
  ],
};

/**
 * Feature list for a tier, in the world the server says we are in.
 *
 * Flag OFF (default): the lists above, unchanged — chat is a paid feature.
 * Flag ON: free gains the chat line, and Basic loses "Unlimited messages" and
 * re-leads on what it still uniquely buys (contact details + who-viewed).
 * Every "Everything in X" chain above stays valid either way, because only the
 * bottom two rungs move.
 */
export const planFeatures = (planKey, freeChatForMutuals) => {
  const base = PLAN_FEATURES[planKey] || [];
  if (!freeChatForMutuals) return base;
  if (planKey === 'free') return [...base, 'Chat with your mutual matches'];
  if (planKey === 'basic_premium') {
    return [
      'View contact details',
      '5 contact unlocks',
      'See who viewed profile',
      'Advanced search filters',
    ];
  }
  return base;
};
