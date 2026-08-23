// ─── Plan feature lists ───────────────────────
// The chat lines are DERIVED from the server's `freeChatForMutuals` flag, never
// hardcoded: with the flag on, "Unlimited messages" as a paid feature is a lie
// (free members message their mutual matches), and with it off, promising free
// chat is a lie in the other direction. `planFeatures()` below is the only
// place either line is written.
// Placeholder for the "Everything in <the tier below this one>" line. It is
// resolved at render time, NOT written here, because the launch offer can
// withdraw a tier: a VIP card reading "Everything in Elite" beside a page with
// no Elite card is a dangling reference the reader cannot resolve, and that is
// exactly what shipped when this list hardcoded the chain.
const EVERYTHING_IN = '\u0000EVERYTHING_IN';

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
    EVERYTHING_IN,
    '15 contact unlocks',
    // Re-termed from the live plan by retermForLivePlan (the regex keys off the
    // trailing "validity"), so this string is a placeholder shape, not a claim.
    '90-day validity',
    'Profile boost',
    'Spotlight listing',
    'Priority customer support',
  ],
  elite: [
    EVERYTHING_IN,
    '30 contact unlocks',
    'Priority ranking in search',
    '6-month validity',
    'Best value per month',
  ],
  vip: [
    EVERYTHING_IN,
    'Unlimited contact unlocks',
    'Verified badge',
    'Full-year validity',
    'Dedicated relationship advisor',
  ],
  nri: [
    EVERYTHING_IN,
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
export const planFeatures = (planKey, freeChatForMutuals, livePlan, prevName) => {
  const base = PLAN_FEATURES[planKey] || [];
  const list = !freeChatForMutuals
    ? base
    : planKey === 'free'
      ? [...base, 'Chat with your mutual matches']
      : planKey === 'basic_premium'
        ? [
          'View contact details',
          '5 contact unlocks',
          'See who viewed profile',
          'Advanced search filters',
        ]
        : base;

  // Resolve the chain line against the tier actually shown below this one.
  // With no previous tier (everything below was withdrawn) the honest
  // comparison is against Free.
  const chained = list.map((line) =>
    (line === EVERYTHING_IN ? `Everything in ${prevName || 'Free'}` : line)
  );

  return retermForLivePlan(chained, livePlan);
};

/**
 * Rewrite the two lines that go stale the moment pricing moves: the unlock
 * count and the validity claim. The launch offer re-terms plans at runtime, so
 * a card that says "5 contact unlocks" beside a plan the server sells with 6 —
 * or "Full-year validity" on a 6-month launch term — is simply false.
 *
 * `livePlan` is a plan object from GET /subscription/plans (`contactUnlocks`
 * is -1 for unlimited there). Without it the static copy is returned unchanged.
 */
const retermForLivePlan = (list, livePlan) => {
  if (!livePlan) return list;

  const unlocks = livePlan.contactUnlocks;
  const unlockLine = unlocks === -1
    ? 'Unlimited contact unlocks'
    : typeof unlocks === 'number'
      ? `${unlocks} contact unlock${unlocks === 1 ? '' : 's'}`
      : null;
  const validityLine = livePlan.duration ? `${livePlan.duration} of full access` : null;

  return list.map((line) => {
    if (unlockLine && /contact unlocks?$/i.test(line)) return unlockLine;
    if (validityLine && /validity$/i.test(line)) return validityLine;
    return line;
  });
};
