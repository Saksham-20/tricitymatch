import i18n from '../i18n';
import { formatIstDate } from './formatDate';

// ─── Plan feature lists ───────────────────────
// The chat lines are DERIVED from the server's `freeChatForMutuals` flag, never
// hardcoded: with the flag on, "Unlimited messages" as a paid feature is a lie
// (free members message their mutual matches), and with it off, promising free
// chat is a lie in the other direction. `planFeatures()` below is the only
// place either line is written.
//
// Lines are stored as ids and turned into text at CALL time (the member can
// switch language after this module loads). Each line keeps its id so callers
// can drop a line by what it IS ("the unlock line", "the chain line") rather
// than by matching English text, which would break in Hindi and Punjabi.

// Placeholder for the "Everything in <the tier below this one>" line. It is
// resolved at render time, NOT written here, because the launch offer can
// withdraw a tier: a VIP card reading "Everything in Elite" beside a page with
// no Elite card is a dangling reference the reader cannot resolve, and that is
// exactly what shipped when this list hardcoded the chain.
const EVERYTHING_IN = { id: 'everythingIn' };
// The unlock count and the validity claim are re-termed from the live plan by
// retermForLivePlan, so the values here are placeholder shapes, not claims.
const UNLOCKS = (count) => ({ id: 'unlocks', count });
const VALIDITY = (key) => ({ id: 'validity', key });
const line = (key) => ({ id: key, key });

const PLAN_FEATURES = {
  free: [
    line('createProfile'),
    line('browseMatches'),
    line('sendInterest'),
    line('basicFilters'),
  ],
  basic_premium: [
    line('viewContact'),
    line('unlimitedMessages'),
    line('whoViewed'),
    line('advancedFilters'),
    UNLOCKS(5),
  ],
  premium_plus: [
    EVERYTHING_IN,
    UNLOCKS(15),
    VALIDITY('validity90Days'),
    line('profileBoost'),
    line('spotlight'),
    line('prioritySupport'),
  ],
  elite: [
    EVERYTHING_IN,
    UNLOCKS(30),
    line('priorityRanking'),
    VALIDITY('validity6Months'),
    line('bestValue'),
  ],
  vip: [
    EVERYTHING_IN,
    UNLOCKS(-1),
    line('verifiedBadge'),
    VALIDITY('validityFullYear'),
    line('relationshipAdvisor'),
  ],
  nri: [
    EVERYTHING_IN,
    UNLOCKS(-1),
    line('priorityNriSupport'),
    line('timezoneMatching'),
    line('localCurrency'),
  ],
};

const isEnglish = () => !i18n.language || i18n.language.startsWith('en');

/**
 * Display name for a plan key. In English the server's own name wins (it is
 * what the plan is sold as); in Hindi/Punjabi the translated label is used.
 */
export const planDisplayName = (planKey, serverName) => {
  const known = i18n.exists(`plans.names.${planKey}`);
  if (isEnglish()) return serverName || (known ? i18n.t(`plans.names.${planKey}`) : planKey);
  return known ? i18n.t(`plans.names.${planKey}`) : (serverName || planKey);
};

/**
 * A server duration label ("3 months", "30 days", "1 year", "Unlimited") in
 * the member's language. English is returned exactly as the server sent it.
 */
export const localDuration = (label) => {
  if (!label || isEnglish()) return label;
  if (label === 'Unlimited') return i18n.t('plans.duration.unlimited');
  const m = /^(\d+) (year|month|day)s?$/.exec(label);
  if (!m) return label;
  return i18n.t(`plans.duration.${m[2]}`, { count: Number(m[1]) });
};

/**
 * What follows the price on a plan card: "/3 months", or "until 10 Jan 2027"
 * when the launch offer sells the plan with a fixed end date (`endsOn`).
 */
export const termSuffix = (plan, fallbackLabel) => (plan?.endsOn
  ? ` ${i18n.t('plans.card.until', { date: formatIstDate(plan.endsOn) })}`
  : `/${localDuration(plan?.duration || fallbackLabel)}`);

const textOf = (item, prevName) => {
  if (item.id === 'everythingIn') {
    return i18n.t('plans.features.everythingIn', { name: prevName || planDisplayName('free') });
  }
  if (item.id === 'unlocks') {
    return item.count === -1
      ? i18n.t('plans.features.unlimitedUnlocks')
      : i18n.t('plans.features.unlocks', { count: item.count });
  }
  if (item.id === 'validity') {
    if (item.endsOn) return i18n.t('plans.features.accessUntil', { date: formatIstDate(item.endsOn) });
    return item.duration
      ? i18n.t('plans.features.fullAccess', { duration: localDuration(item.duration) })
      : i18n.t(`plans.features.${item.key}`);
  }
  return i18n.t(`plans.features.${item.key}`);
};

/**
 * Feature lines for a tier as `{ id, text }`, in the world the server says we
 * are in. Use this when a caller needs to drop a line by kind.
 *
 * Flag OFF (default): the lists above, unchanged — chat is a paid feature.
 * Flag ON: free gains the chat line, and Basic loses "Unlimited messages" and
 * re-leads on what it still uniquely buys (contact details + who-viewed).
 * Every "Everything in X" chain above stays valid either way, because only the
 * bottom two rungs move.
 */
export const planFeatureItems = (planKey, freeChatForMutuals, livePlan, prevName) => {
  const base = PLAN_FEATURES[planKey] || [];
  const list = !freeChatForMutuals
    ? base
    : planKey === 'free'
      ? [...base, line('chatMutuals')]
      : planKey === 'basic_premium'
        ? [
          line('viewContact'),
          UNLOCKS(5),
          line('whoViewed'),
          line('advancedFilters'),
        ]
        : base;

  // Resolve the chain line against the tier actually shown below this one.
  // With no previous tier (everything below was withdrawn) the honest
  // comparison is against Free.
  return retermForLivePlan(list, livePlan)
    .map((item) => ({ id: item.id, text: textOf(item, prevName) }));
};

/** Feature lines for a tier as plain text (see planFeatureItems). */
export const planFeatures = (planKey, freeChatForMutuals, livePlan, prevName) =>
  planFeatureItems(planKey, freeChatForMutuals, livePlan, prevName).map((item) => item.text);

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
  const liveUnlocks = unlocks === -1 || typeof unlocks === 'number';

  return list.map((item) => {
    if (liveUnlocks && item.id === 'unlocks') return UNLOCKS(unlocks);
    if (livePlan.endsOn && item.id === 'validity') return { ...item, endsOn: livePlan.endsOn };
    if (livePlan.duration && item.id === 'validity') return { ...item, duration: livePlan.duration };
    return item;
  });
};
