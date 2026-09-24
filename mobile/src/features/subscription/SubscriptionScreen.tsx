import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  PixelRatio,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { PressableScale, StaggeredEntrance } from '../../components/motion';
import { ListSkeleton } from '../../components/ui/skeletons';
import { SkeletonBlock } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import PickerSheet from '../../components/ui/PickerSheet';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../utils/toast';
import { haptics } from '../../utils/haptics';
import { getMe } from '../../api/auth';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { PLANS, isPlanAtLeast } from '@shared/constants/plans';
import {
  getPlans,
  getUnlockBundles,
  createOrder,
  verifyPayment,
  verifyGooglePlay,
  getSubscriptionHistory,
  createBundleOrder,
  verifyBundlePayment,
} from '../../api/subscription';
import {
  purchaseGooglePlaySubscription,
  finishGooglePlayPurchase,
  isGooglePlayAvailable,
  IAP_UNAVAILABLE,
} from '../../utils/iap';
import { detectCurrency, formatLocalPrice, type DetectedCurrency } from '../../utils/currency';
import { tapSize } from '../../utils/elderTheme';
import { CONFIG } from '../../constants/config';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import type { MainStackParamList } from '../../navigation/types';
import type { PlanFeatures, Subscription, SubscriptionPlanType } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// On iOS, Apple's rules make in-app purchase of digital subscriptions costly, so
// (like Spotify) we send buyers to the website to pay. Android keeps in-app
// billing (Razorpay + Google Play, user-choice).
const WEB_SUBSCRIPTION_URL = 'https://tricitymatch.com/subscription';
const WEB_REFUND_URL = 'https://tricitymatch.com/refund-policy';
const isIOS = Platform.OS === 'ios';

// ─── Razorpay stub (dynamic require for native build) ─────────────────────────

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color: string };
};

/**
 * Thrown when the checkout cannot be opened at all — the native module is absent
 * (Expo Go) or no publishable key is configured. Distinct from a payment that
 * opened and then failed or was cancelled, which must surface as itself.
 */
export class PaymentsUnavailableError extends Error {
  constructor() {
    super('Payments are unavailable in this build');
    this.name = 'PaymentsUnavailableError';
  }
}

function loadRazorpay(): { open: (o: RazorpayOptions) => Promise<unknown> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-razorpay').default ?? null;
  } catch {
    return null;
  }
}

async function openRazorpay(options: RazorpayOptions): Promise<{
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}> {
  const RazorpayCheckout = loadRazorpay();

  // Module missing or unconfigured. In development we hand back a stub so the
  // rest of the flow can be exercised; in a release build we must NOT — feeding
  // a fabricated payment id into /verify-payment turns "payments are not
  // available" into "your payment failed on the server", and the earlier version
  // of this function did exactly that.
  if (!RazorpayCheckout || !CONFIG.IS_RAZORPAY_CONFIGURED) {
    if (__DEV__ && !RazorpayCheckout) {
      return {
        razorpay_payment_id: 'pay_DEV_STUB',
        razorpay_order_id: options.order_id,
        razorpay_signature: 'DEV_STUB_SIG',
      };
    }
    throw new PaymentsUnavailableError();
  }

  // Anything thrown from here on is a real checkout outcome (cancelled, failed,
  // network) and is propagated. It must never be converted into a fake success.
  return (await RazorpayCheckout.open(options)) as {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };
}

// ─── Plan tier colours ────────────────────────────────────────────────────────

// These maps are exhaustive `Record<SubscriptionPlanType, …>` on purpose: adding
// a tier to shared/src/constants/plans.ts must fail the mobile typecheck rather
// than render a blank chip. founding_premium arrived that way and sat red because
// the mobile workspace was outside the root lint/test gate — it is inside it now.
const makePlanColour = (c: ThemeColours): Record<SubscriptionPlanType, string> => ({
  free:             c.planFree,
  founding_premium: c.planElite,
  basic_premium:    c.planPlus,
  premium_plus:     c.planPremium,
  elite:            c.planElite,
  vip:              c.g600,
  nri:              c.accent,
});

const PLAN_ICON: Record<SubscriptionPlanType, keyof typeof Ionicons.glyphMap> = {
  free:             'person-outline',
  founding_premium: 'sparkles-outline',
  basic_premium:    'star-outline',
  premium_plus:     'diamond-outline',
  elite:            'ribbon-outline',
  vip:              'trophy-outline',
  nri:              'globe-outline',
};

// ─── Feature rows ────────────────────────────────────────────────────────────

type FeatureValue = boolean | string | number | null;

interface FeatureDef {
  key: string;
  label: string;
  value: (p: PlanFeatures) => FeatureValue;
  /** A qualifier that belongs beside the benefit it limits, drawn under the row. */
  note?: (p: PlanFeatures) => string | null;
}

/**
 * The rolling-24h ceiling the server enforces on an unlimited tier
 * (`unlockDailyCap` on GET /subscription/plans). It is not on the shared
 * PlanFeatures shape and api/subscription.ts does not carry it across yet, so it
 * is read defensively: with the number the row says how many, without it the row
 * still says a daily limit applies. Selling "Unlimited" with the ceiling
 * undisclosed is the claim the server's own comment says it exists to prevent.
 */
const unlockDailyCap = (p: PlanFeatures): number | null => {
  const v = (p as PlanFeatures & { unlockDailyCap?: unknown }).unlockDailyCap;
  return typeof v === 'number' && v > 0 ? v : null;
};

const FEATURES: FeatureDef[] = [
  { key: 'chat',    label: 'Chat with matches',      value: (p) => p.canChat },
  { key: 'likedMe', label: 'See who liked me',       value: (p) => p.canSeeWhoLikedMe },
  // Only sold where this build can deliver it: the call buttons are hidden when
  // Agora is not configured (config.ts: absent credentials HIDE the feature), so a
  // card advertising calls would promise something the app cannot show. See
  // `featureRows` below, which drops this row when the gate is off.
  { key: 'calls',   label: 'Voice & video calls',    value: (p) => p.canMakeVoiceVideoCalls },
  { key: 'filters', label: 'Advanced filters',       value: (p) => p.canUseAdvancedFilters },
  { key: 'boost',   label: 'Profile boost',          value: (p) => p.canBoostProfile },
  { key: 'rm',      label: 'Relationship manager',   value: (p) => p.hasRelationshipManager },
  {
    key: 'unlocks',
    label: 'Contact unlocks',
    // null = unlimited on a paid tier; the free tier never carries null.
    value: (p) => (p.contactUnlocks === null ? (p.planType === 'free' ? false : 'Unlimited') : p.contactUnlocks),
    note: (p) => {
      if (p.contactUnlocks !== null || p.planType === 'free') return null;
      const cap = unlockDailyCap(p);
      return cap ? `Up to ${cap} a day` : 'A daily fair-use limit applies';
    },
  },
];

const isOn = (v: FeatureValue) => v === true || typeof v === 'string' || (typeof v === 'number' && v > 0);

function FeatureRow({ label, value, note }: { label: string; value: FeatureValue; note?: string | null }) {
  const { c } = useTheme();
  const fr = React.useMemo(() => makeFr(c), [c]);
  const tick = isOn(value);
  return (
    <View>
      <View style={fr.row}>
        {/* successAccent, not success: the plain green is unreadable on the dark card.
            The cross stays textMuted: a graphic needs 3:1, and the label beside it
            carries the text contrast. */}
        <Ionicons
          name={tick ? 'checkmark-circle' : 'close-circle'}
          size={16}
          color={tick ? c.successAccent : c.textMuted}
          style={fr.icon}
        />
        {/* textSecondary for the not-included label: textMuted is 3.4:1 on the
            light card, under the 4.5:1 a 15pt label owes. */}
        <Text variant="subhead" color={tick ? 'textPrimary' : 'textSecondary'} style={fr.label}>{label}</Text>
        {typeof value === 'number' && value > 0 && <Text variant="subhead" color="fgStrong">{value}</Text>}
        {typeof value === 'string' && <Text variant="subhead" color="fgStrong">{value}</Text>}
      </View>
      {tick && note ? <Text variant="caption" color="textSecondary" style={fr.note}>{note}</Text> : null}
    </View>
  );
}

const makeFr = (_c: ThemeColours) => StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  icon:  { marginRight: 8 },
  label: { flex: 1 },
  // indented to sit under the label (16pt icon + 8pt gap)
  note:  { marginLeft: 24, marginTop: -2, marginBottom: 4 },
});

// ─── Plan Card ────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: PlanFeatures;
  /** Only the feature rows at least one visible plan offers (see the screen). */
  rows: FeatureDef[];
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
  currency: DetectedCurrency;
}

// The card's border width, and the ribbon's estimated height before it has been
// measured: Badge's caption line (16pt, scaled by the OS text size) plus its 3pt
// vertical padding twice. onLayout replaces the estimate on the first frame.
const CARD_BORDER = 1.5;
const ribbonEstimate = () => Math.ceil(16 * PixelRatio.getFontScale()) + 6;

function PlanCard({ plan, rows, isCurrent, isSelected, onSelect, currency }: PlanCardProps) {
  const { c } = useTheme();
  const pc = React.useMemo(() => makePc(c), [c]);
  // The ribbon straddles the card's top edge, and its height grows with the OS
  // text size (Badge's text scales). A fixed offset only fit one size: from about
  // 1.4x the pill intruded into the header, and at accessibility sizes it covered
  // the plan title and price. Both its offset and the room reserved for it come
  // from its measured height.
  const [ribbonH, setRibbonH] = React.useState(ribbonEstimate);
  const ribbonHalf = Math.ceil(ribbonH / 2);
  const localPrice = plan.price > 0 ? formatLocalPrice(plan.price, currency) : null;
  const colour = React.useMemo(() => makePlanColour(c), [c])[plan.planType];
  const icon = PLAN_ICON[plan.planType];
  // The ribbon text is the SERVER's badge (admin-editable, and the backend
  // deliberately refuses "Most Popular": it is a social-proof claim there is no
  // purchase history to back). It used to be a client-side map keyed by tier,
  // which printed "Most Popular" on a plan the server never called that.
  const highlight = plan.badge ?? null;
  const isGold = !!highlight; // a badged plan gets the gold (premium signal) treatment
  // Elevation is declared once: the border. It doubles as the selection state,
  // so there is no shadow on top of it.
  const borderColour = isGold ? c.g500 : isSelected ? c.accent : c.border;

  const priceSpoken = plan.price > 0
    ? `₹${plan.price.toLocaleString('en-IN')}${plan.durationDays ? ` for ${plan.durationDays} days` : ''}` +
      (plan.mrp && plan.mrp > plan.price ? `, regular price ₹${plan.mrp.toLocaleString('en-IN')}` : '')
    : 'free';
  const included = rows
    .map((r) => ({ r, v: r.value(plan) }))
    .filter(({ v }) => isOn(v))
    .map(({ r, v }) => {
      const base = typeof v === 'string' || typeof v === 'number' ? `${r.label}: ${v}` : r.label;
      const note = r.note?.(plan);
      return note ? `${base} (${note})` : base;
    });
  // The card is one radio option. Its children are read as a single element, so
  // the label has to carry what the visuals show: name, price, tenure, and
  // which plan is the member's own.
  const spoken = [plan.label, highlight, priceSpoken, isCurrent ? 'your current plan' : null]
    .filter(Boolean)
    .join(', ');
  const hint = included.length > 0
    ? `Includes ${included.join(', ')}. Double tap to select this plan.`
    : 'Double tap to select this plan.';

  return (
    <PressableScale
      // No `haptic` on press-in: this card sits in a ScrollView, so a touch that
      // starts a scroll would buzz for a selection that never happened. The
      // screen fires the haptic from onSelect, the commit.
      style={[
        pc.card,
        { borderColor: borderColour },
        highlight
          ? {
              marginTop: ribbonHalf + spacing.xs,
              paddingTop: Math.max(spacing.lg, ribbonHalf + spacing.sm),
            }
          : null,
      ]}
      onPress={onSelect}
      testID={`plan-card-${plan.planType}`}
      accessibilityLabel={spoken}
      accessibilityHint={hint}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {highlight ? (
        <View
          style={[pc.highlightWrap, { top: -(ribbonH / 2) - CARD_BORDER }]}
          pointerEvents="none"
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (Math.abs(h - ribbonH) > 0.5) setRibbonH(h);
          }}
        >
          {/* the one place gold fills (Badge 'vip' is the gold gradient pill) */}
          <Badge label={highlight} tone="vip" style={pc.highlightPill} />
        </View>
      ) : null}
      <View style={pc.header}>
        <Ionicons name={icon} size={26} color={colour} />
        <View style={pc.titleCol}>
          <View style={pc.titleRow}>
            {/* fgStrong, not the tier colour: three tiers are gold and gold is never text */}
            <Text variant="title3" color="fgStrong">{plan.label}</Text>
            {isCurrent ? (
              <Badge label="Current" tone={plan.planType === 'free' ? 'neutral' : 'primary'} style={pc.currentPill} />
            ) : null}
          </View>
          {plan.price > 0 ? (
            <>
              <View style={pc.priceRow}>
                <Text variant="headline" color="fgStrong">₹{plan.price.toLocaleString('en-IN')}</Text>
                {plan.mrp && plan.mrp > plan.price ? (
                  <Text variant="subhead" color="textSecondary" style={pc.mrp}>₹{plan.mrp.toLocaleString('en-IN')}</Text>
                ) : null}
                <Text variant="subhead" color="textSecondary">{plan.durationDays ? ` / ${plan.durationDays} days` : ''}</Text>
              </View>
              {plan.perMonth ? (
                <Text variant="caption" color="textSecondary" style={pc.perMonth}>≈ ₹{plan.perMonth.toLocaleString('en-IN')}/month</Text>
              ) : null}
              {localPrice ? (
                <Text variant="caption" color="textSecondary" style={pc.perMonth}>≈ {localPrice} (charged in ₹)</Text>
              ) : null}
            </>
          ) : (
            <Text variant="headline" color="fgStrong">Free</Text>
          )}
        </View>
        {isSelected && <Ionicons name="checkmark-circle" size={22} color={isGold ? c.g500 : c.accent} />}
      </View>

      <View style={[pc.divider, { backgroundColor: c.hairline }]} />

      {rows.map((r) => (
        <FeatureRow key={r.key} label={r.label} value={r.value(plan)} note={r.note?.(plan)} />
      ))}
    </PressableScale>
  );
}

const makePc = (c: ThemeColours) => StyleSheet.create({
  card: {
    borderWidth: CARD_BORDER,
    borderColor: c.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: c.surfaceCard,
    position: 'relative',
  },
  // Full-width, centred, auto-sized: the ribbon used to be a fixed 120pt box,
  // which clipped "Recommended" the moment the OS text size went up. Its `top`
  // is set inline from its measured height (see PlanCard).
  highlightWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Badge's gold branch sets borderWidth without a colour, which draws a black hairline.
  highlightPill: { alignSelf: 'center', borderColor: 'transparent' },
  currentPill: { alignSelf: 'center' },
  header:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  titleCol:  { flex: 1 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.sm },
  priceRow:  { flexDirection: 'row', alignItems: 'baseline', marginTop: 2, flexWrap: 'wrap' },
  mrp:       { textDecorationLine: 'line-through', marginLeft: 6 },
  perMonth:  { marginTop: 1 },
  divider:   { height: 1, backgroundColor: c.hairline, marginVertical: spacing.sm },
});

// ─── Plan list skeleton ───────────────────────────────────────────────────────

const SKELETON_FEATURE_ROWS = 5;

/**
 * Card-shaped placeholders that mirror a loaded plan card (icon + title/price
 * header, divider, feature rows). The shared SubscriptionSkeleton draws three flat
 * 150pt slabs, so a catalogue of Free + one Premium card changed height when it
 * arrived. The second placeholder reserves the ribbon's room, as a badged card does.
 */
function PlanCardSkeleton({ ribbon }: { ribbon?: boolean }) {
  const { c } = useTheme();
  const sk = React.useMemo(() => makeSk(c), [c]);
  return (
    <View style={[sk.card, ribbon ? sk.cardRibbon : null]}>
      <View style={sk.header}>
        <SkeletonBlock width={26} height={26} radius={13} />
        <View style={sk.titleCol}>
          <SkeletonBlock width={110} height={22} />
          <SkeletonBlock width={150} height={20} />
          <SkeletonBlock width={90} height={14} />
        </View>
      </View>
      <View style={sk.divider} />
      {Array.from({ length: SKELETON_FEATURE_ROWS }, (_, i) => (
        <View key={i} style={sk.row}>
          <SkeletonBlock width={16} height={16} radius={8} />
          <SkeletonBlock width={i % 2 ? '48%' : '62%'} height={14} />
        </View>
      ))}
    </View>
  );
}

function PlanListSkeleton() {
  return (
    <View
      testID="plans-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <PlanCardSkeleton />
      <PlanCardSkeleton ribbon />
    </View>
  );
}

const makeSk = (c: ThemeColours) => StyleSheet.create({
  card:       { borderWidth: CARD_BORDER, borderColor: c.border, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, backgroundColor: c.surfaceCard },
  cardRibbon: { marginTop: spacing.lg },
  header:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  titleCol:   { flex: 1, gap: spacing.xs },
  divider:    { height: 1, backgroundColor: c.hairline, marginVertical: spacing.sm },
  row:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 },
});

// ─── History Item ─────────────────────────────────────────────────────────────

const STATUS_TONE: Record<Subscription['status'], 'success' | 'warning' | 'neutral'> = {
  active:    'success',
  pending:   'warning',
  expired:   'neutral',
  cancelled: 'neutral',
};

/**
 * What the member paid, or why there is nothing to show as paid.
 *
 * `amount` alone is not proof of a payment: an admin grant stores the plan's list
 * price with no payment reference, and an order that was created and abandoned
 * keeps its amount too. The payment reference is the only evidence money moved
 * (a Play purchase token is stored in the same column, so store purchases still
 * read as paid); an order id without one is an order that never completed.
 * `amount` is a DECIMAL column, which arrives as a string, so it is coerced.
 */
function historyAmount(sub: Subscription): string {
  const rupees = Number(sub.amount ?? 0);
  if (sub.razorpayPaymentId) return `₹${rupees.toLocaleString('en-IN')}`;
  if (sub.razorpayOrderId) return 'Not paid';
  return rupees > 0 ? 'Granted' : 'Free';
}

function HistoryItem({ sub }: { sub: Subscription }) {
  const { c } = useTheme();
  const hi = React.useMemo(() => makeHi(c), [c]);
  const colour = React.useMemo(() => makePlanColour(c), [c])[sub.planType];
  const label = PLANS[sub.planType]?.label ?? sub.planType;
  const when = sub.startDate ?? sub.createdAt;
  const date = when ? new Date(when).toLocaleDateString('en-IN') : 'Date unavailable';
  const amount = historyAmount(sub);
  const status = sub.status.charAt(0).toUpperCase() + sub.status.slice(1);
  return (
    <View
      style={hi.row}
      testID={`history-item-${sub.id}`}
      accessible
      accessibilityLabel={`${label}, ${date}, ${amount}, ${status}`}
    >
      <View style={[hi.dot, { backgroundColor: colour }]} />
      <View style={hi.info}>
        <Text variant="headline" color="textPrimary">{label}</Text>
        <Text variant="footnote" color="textSecondary" style={hi.date}>{date} · {amount}</Text>
      </View>
      <Badge label={status} tone={STATUS_TONE[sub.status] ?? 'neutral'} style={hi.badge} />
    </View>
  );
}

const makeHi = (c: ThemeColours) => StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  dot:   { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  info:  { flex: 1 },
  date:  { marginTop: 2 },
  badge: { alignSelf: 'center', marginLeft: spacing.sm },
});

// ─── Payment outcome helpers ──────────────────────────────────────────────────

/** The server's own reason for a refusal ("That plan is not available right now"), if it sent one. */
function serverMessage(e: unknown): string | null {
  const m = (e as { response?: { data?: { error?: { message?: unknown } } } })?.response?.data?.error?.message;
  return typeof m === 'string' && m.length > 0 ? m : null;
}

/**
 * Razorpay's Android SDK rejects `{ code, description }`. Card payments never
 * reach here on iOS, which pays on the website.
 *
 * - `dismissed`: code 0 (PAYMENT_CANCELED), the member closed the checkout. The
 *   only outcome where "no charge was made" is a fact.
 * - `cancelled`: an SDK build that WORDS the cancellation instead of numbering
 *   it. Free text is not proof nothing was charged, so the copy stays neutral.
 * - `failed`: anything else (declined, network, gateway).
 */
function checkoutOutcome(e: unknown): 'dismissed' | 'cancelled' | 'failed' {
  const err = e as { code?: unknown; description?: unknown; message?: unknown };
  if (err?.code === 0) return 'dismissed';
  return /cancel/i.test(String(err?.description ?? err?.message ?? '')) ? 'cancelled' : 'failed';
}

type PayMethod = 'razorpay' | 'play';

/**
 * An outcome the member has to ACT on (not just be told about) stays on screen
 * with its recovery, instead of a toast that is gone in four seconds and that a
 * screen reader never hears. Every case where money may have left the member's
 * account and the plan is not active routes here.
 */
type NoticeAction = 'website' | 'support' | 'refresh' | 'retry';
type Notice = { text: string; actions: NoticeAction[] };

const NOTICE_ACTION_COPY: Record<NoticeAction, { label: string; a11y: string }> = {
  website: { label: 'Open website', a11y: 'Open the website to subscribe' },
  support: { label: 'Contact support', a11y: 'Contact support' },
  refresh: { label: 'Refresh', a11y: 'Refresh your plan' },
  retry:   { label: 'Try again', a11y: 'Try confirming your payment again' },
};

const CHARGED_UNVERIFIED =
  'We could not confirm your payment yet. Try again. If an amount was deducted and this keeps failing, contact support and we will sort it out.';

type PaymentTriple = Parameters<typeof verifyPayment>[0];

/**
 * A payment the gateway or the store has already TAKEN, whose confirmation to our
 * server failed. While one is held, nothing else on this screen can start a
 * purchase: the server's create-order cancels every pending order, and the held
 * payment is waiting on exactly that pending row, so a second tap would cancel
 * the order the first payment needs and charge the member again. It carries what
 * is needed to re-send the confirmation (the server treats a repeat as a no-op).
 */
type Unverified =
  | { kind: 'plan'; payment: PaymentTriple }
  | { kind: 'bundle'; payment: PaymentTriple }
  | { kind: 'play'; productId: string; purchaseToken: string };

/**
 * A toast is not announced to screen readers (toastConfig carries no live
 * region), so every outcome on this screen is also spoken. Remove once the toast
 * primitive announces on its own.
 */
const announce = (title: string, body?: string) =>
  AccessibilityInfo.announceForAccessibility([title, body].filter(Boolean).join('. '));

const tell = {
  success: (title: string, body?: string) => { showToast.success(title, body); announce(title, body); },
  error: (title: string, body?: string) => { showToast.error(title, body); announce(title, body); },
  info: (title: string, body?: string) => { showToast.info(title, body); announce(title, body); },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const { c, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const currentPlan = (user?.subscriptionPlan ?? 'free') as SubscriptionPlanType;
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanType>(currentPlan);
  const [tab, setTab] = useState<'plans' | 'history'>('plans');
  const [paying, setPaying] = useState(false);
  const [methodSheet, setMethodSheet] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // A payment taken but not yet confirmed to our server (see `Unverified`).
  const [unverified, setUnverified] = useState<Unverified | null>(null);
  // The plan the in-flight purchase is FOR. finishPlanPurchase names it in the
  // confirmation, and the member may tap another card while a confirmation is
  // being retried, so it cannot read the live selection.
  const purchaseLabel = useRef('Premium');
  const currency = useMemo(() => detectCurrency(), []);
  const playAvailable = useMemo(() => isGooglePlayAvailable(), []);

  // Live top-ups: the launch offer can reprice or withdraw a bundle, and a
  // withdrawn bundle is refused at checkout. Never render the static list, not
  // even while this loads.
  const {
    data: liveBundles,
    isLoading: bundlesLoading,
    isError: bundlesError,
    refetch: refetchBundles,
  } = useQuery({
    queryKey: [...queryKeys.plans, 'bundles'],
    queryFn: getUnlockBundles,
  });

  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: queryKeys.plans,
    queryFn: getPlans,
    staleTime: 10 * 60 * 1000,
  });

  const { data: history, isLoading: histLoading, refetch: refetchHistory } = useQuery({
    queryKey: queryKeys.subscription,
    queryFn: getSubscriptionHistory,
    enabled: tab === 'history',
  });
  // The error branches below key on "finished loading and holds no data" rather
  // than on `isError`: an offline member's query is PAUSED (neither loading nor
  // errored) and would otherwise fall through to "no plans" / "no payments yet",
  // which says the server has nothing when the truth is we could not ask. A
  // failed BACKGROUND refetch that still holds data keeps showing that data.

  // Never fall back to the static catalogue (doctrine §10.9): a failed or
  // empty fetch shows loading/error, not five withdrawn tiers at regular
  // prices that checkout refuses. `plans` defaults to [] so downstream
  // filters/maps are safe while the error state renders.
  const planList = (plans ?? []) as PlanFeatures[];

  // Top-ups apply only to a paid plan with a FINITE unlock allowance (the
  // server refuses one on an unlimited plan). The allowance comes from the LIVE
  // catalogue: the launch offer sells Premium as unlimited while the static
  // PLANS table still says 15, and reading the static table showed unlimited
  // members a top-up the server would reject. Only a plan the server no longer
  // lists (a granted or withdrawn tier the member still holds) has no live
  // entry, and for those the static row is the only record of the allowance.
  // Nothing is offered until the catalogue has loaded, so it cannot flash in
  // and then vanish.
  const currentLive = planList.find((p) => p.planType === currentPlan);
  const currentUnlocks = currentLive ? currentLive.contactUnlocks : PLANS[currentPlan]?.contactUnlocks;
  const bundlesEligible = currentPlan !== 'free' && !!plans && currentUnlocks !== null;
  // Android tops up through Razorpay only; iOS hands off to the website. A row
  // that can only end in "unavailable" is not offered.
  const bundlesPayable = isIOS || CONFIG.IS_RAZORPAY_CONFIGURED;

  // NRI Connect is a segment tier. Members who declared NRI status see it, and
  // so does anyone already on it (otherwise the page would hide their own
  // plan); everyone else is spared a card they would only have to rule out.
  const showsNri = user?.Profile?.isNri === true || currentPlan === 'nri';
  const visiblePlans = planList.filter((p) => p.segment !== 'nri' || showsNri);
  const paidPlans = visiblePlans.filter((p) => p.planType !== 'free');

  // A feature row no visible plan offers would render as a column of crosses
  // advertising something nobody can buy here. The calls row also needs Agora:
  // the shared capability table says Premium can call, but this build hides the
  // call buttons without credentials, so the card must not promise them.
  const featureRows = FEATURES.filter(
    (f) => (f.key !== 'calls' || CONFIG.IS_AGORA_CONFIGURED) && visiblePlans.some((p) => isOn(f.value(p))),
  );

  // Everything price-shaped on this screen reads the SERVER's plan. `PLANS`
  // above is only ever asked for a plan's NAME when the server no longer lists
  // it (a withdrawn tier the member still holds).
  const selectedLive = visiblePlans.find((p) => p.planType === selectedPlan);
  const selectedLabel = selectedLive?.label ?? PLANS[selectedPlan]?.label ?? 'Premium';

  // Same rank rule as the server (shared isPlanAtLeast mirrors TIER_RANK): a
  // member can only move UP a tier while their plan is active, and the server
  // 409s anything else, so the button says so instead of letting them try.
  const canUpgrade = selectedPlan !== 'free' && !isPlanAtLeast(currentPlan, selectedPlan);

  // A lone upgrade path is the obvious choice: pre-select it, so the first
  // thing a free member sees is a live Subscribe button, not a disabled
  // "Current plan" over the only card they can buy.
  const didPreselect = useRef(false);
  useEffect(() => {
    if (didPreselect.current || visiblePlans.length === 0) return;
    didPreselect.current = true;
    const upgrades = visiblePlans.filter((p) => p.planType !== 'free' && !isPlanAtLeast(currentPlan, p.planType));
    if (upgrades.length === 1 && selectedPlan === currentPlan) setSelectedPlan(upgrades[0].planType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePlans.length]);

  // A refetch can drop the selected tier (the server just refused it as
  // withdrawn). Fall back to the member's own plan so the CTA stops offering a
  // card that is no longer on the page.
  const selectedListed = visiblePlans.some((p) => p.planType === selectedPlan);
  useEffect(() => {
    if (plans && selectedPlan !== currentPlan && !selectedListed) setSelectedPlan(currentPlan);
  }, [plans, selectedPlan, currentPlan, selectedListed]);

  // A notice appears without a tap on it, so it is announced. announce() rather
  // than a live region: `accessibilityLiveRegion` is Android-only, and using both
  // reads the notice twice on Android.
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice.text);
  }, [notice]);

  // A load that FAILED also appears without a tap: the skeleton is replaced by an
  // error card a screen-reader member would otherwise wait on forever. Announced
  // once per transition into the state (the string is the dependency).
  // Not loading and no catalogue at all is a failed (or paused, offline) load,
  // whether or not react-query has flagged it isError: "no plans available"
  // would tell an offline member the server has nothing to sell.
  const plansProblem = plansLoading
    ? null
    : !plans
    ? "Couldn't load plans. Check your connection and try again."
    : visiblePlans.length === 0
    ? 'No plans available right now.'
    : null;
  useEffect(() => {
    if (plansProblem) AccessibilityInfo.announceForAccessibility(plansProblem);
  }, [plansProblem]);

  const historyProblem = tab === 'history' && !histLoading && !history;
  useEffect(() => {
    if (historyProblem) {
      AccessibilityInfo.announceForAccessibility("Couldn't load payment history. Check your connection and try again.");
    }
  }, [historyProblem]);

  const bundlesProblem = bundlesEligible && bundlesPayable && bundlesError && !liveBundles;
  useEffect(() => {
    if (bundlesProblem) AccessibilityInfo.announceForAccessibility("Couldn't load top-ups. Check your connection and try again.");
  }, [bundlesProblem]);

  /**
   * After money moved and the server activated something, make the app agree.
   *
   * `queryKeys.me` is the PROFILE query, not the entitlement: every gate in the
   * app (Chat, Matches, ProfileDetail, this screen's own Current badge) reads
   * `authStore.user.subscriptionPlan`, and nothing else rewrites that until the
   * next cold start. Without this the member is told "Plan activated", is sent
   * back, and still sees the Chat lock and a live Subscribe button. `/auth/me`
   * returns the server-derived plan, so it is the source of truth to copy.
   * Returns whether the store now agrees with the server.
   */
  const syncMember = async (): Promise<boolean> => {
    queryClient.invalidateQueries({ queryKey: queryKeys.me });
    queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
    try {
      setUser(await getMe());
      return true;
    } catch {
      return false;
    }
  };

  // The payment is real either way, so the success is reported either way; only
  // leaving the screen depends on the app having caught up. If it has not, stay
  // and say how to finish, with a working retry.
  const finishPlanPurchase = async () => {
    const label = purchaseLabel.current;
    const synced = await syncMember();
    tell.success('Plan activated', `${label} is active on your account.`);
    if (synced) {
      navigation.goBack();
    } else {
      setNotice({
        text: `${label} is active, but this screen could not refresh your plan. Refresh to see it.`,
        actions: ['refresh'],
      });
    }
  };

  const retrySync = async () => {
    setPaying(true);
    try {
      if (await syncMember()) {
        setNotice(null);
        navigation.goBack();
      } else {
        tell.error("Couldn't refresh", 'Check your connection and try again.');
      }
    } finally {
      setPaying(false);
    }
  };

  const verifyMutation = useMutation({
    mutationFn: verifyPayment,
    // Returning the promise keeps the mutation pending (and the CTA busy) until
    // the member's plan has been re-read.
    onSuccess: () => {
      setUnverified(null);
      setNotice(null);
      return finishPlanPurchase();
    },
    // The payment went through at Razorpay; only our confirmation failed. The
    // member may have been charged, so the purchase is HELD (no second order can
    // start) and the notice stays, with a retry that re-sends this same payment.
    onError: (_e, payment) => {
      setUnverified({ kind: 'plan', payment });
      setNotice({ text: CHARGED_UNVERIFIED, actions: ['retry', 'support'] });
    },
  });

  /**
   * Re-send the confirmation for the held payment. Safe to repeat: the server
   * answers a payment it already processed with the existing subscription (or
   * the already-credited top-up), so a first request that actually landed and
   * only lost its response cannot double-activate or double-credit.
   */
  const retryVerify = async () => {
    const held = unverified;
    if (!held) return;
    if (held.kind === 'plan') {
      // Same mutation, same payment: onSuccess / onError take it from here, and
      // the CTA stays busy while it is pending.
      verifyMutation.mutate(held.payment);
      return;
    }
    setPaying(true);
    try {
      if (held.kind === 'bundle') {
        const { unlocks } = await verifyBundlePayment(held.payment);
        setUnverified(null);
        setNotice(null);
        await syncMember();
        tell.success('Unlocks added', `${unlocks} contact unlock${unlocks === 1 ? '' : 's'} credited.`);
      } else {
        await verifyGooglePlay({ productId: held.productId, purchaseToken: held.purchaseToken });
        await finishGooglePlayPurchase();
        setUnverified(null);
        setNotice(null);
        await finishPlanPurchase();
      }
    } catch {
      // Still unconfirmed: the hold and the notice stay exactly as they were.
      tell.error("Still couldn't confirm", 'Try again in a moment, or contact support.');
    } finally {
      setPaying(false);
    }
  };

  // iOS: send the buyer to the website to pay (avoids Apple's IAP + ~30% cut).
  const openWebsiteCheckout = () => {
    Linking.openURL(WEB_SUBSCRIPTION_URL).catch(() =>
      tell.error('Could not open browser', `Visit ${WEB_SUBSCRIPTION_URL} to subscribe.`),
    );
  };

  const openRefundPolicy = () => {
    Linking.openURL(WEB_REFUND_URL).catch(() =>
      tell.error('Could not open browser', `Visit ${WEB_REFUND_URL} to read it.`),
    );
  };

  const runNoticeAction = (a: NoticeAction) => {
    if (a === 'website') openWebsiteCheckout();
    else if (a === 'support') navigation.navigate('Support');
    else if (a === 'retry') void retryVerify();
    else retrySync();
  };

  /**
   * One place that turns a failed checkout into copy that is TRUE for where it
   * failed. This used to be a single catch that toasted "Payment cancelled, no
   * charge was made" for every failure, which was wrong three ways: a server
   * refusal ("that plan is not available") is not a cancellation, a declined
   * card is not a cancellation, and a payment that succeeded but could not be
   * verified had very much been charged.
   *
   * Anything after the order exists may have charged the member, so those
   * outcomes are a persistent notice with a route to support; only the
   * outcomes where nothing could have been charged are a passing toast.
   */
  const reportCheckoutFailure = (
    e: unknown,
    phase: 'order' | 'checkout',
    action: string,
    refreshCatalogue: () => void,
  ) => {
    if (phase === 'order') {
      // No order was created, so no checkout opened and nothing could be charged.
      const reason = serverMessage(e);
      // A refusal with a reason ("not available right now") means the list on
      // screen is stale, so re-read it rather than leave the card up.
      if (reason) refreshCatalogue();
      tell.error("Couldn't start checkout", reason ?? 'Check your connection and try again. You have not been charged.');
      return;
    }
    if (e instanceof PaymentsUnavailableError) {
      setNotice({
        text: `Card and UPI payments are not available in this build. ${action} on our website instead.`,
        actions: ['website'],
      });
      return;
    }
    const outcome = checkoutOutcome(e);
    if (outcome === 'dismissed') {
      tell.info('Payment cancelled', 'No charge was made.');
      return;
    }
    setNotice({
      text: outcome === 'cancelled'
        ? 'Payment cancelled. If you were charged, contact support and we will sort it out.'
        : "Your payment didn't go through. If an amount was deducted, contact support and we will sort it out.",
      actions: ['support'],
    });
  };

  const payViaRazorpay = async () => {
    if (unverified) return;
    purchaseLabel.current = selectedLabel;
    setPaying(true);
    setNotice(null);
    let phase: 'order' | 'checkout' = 'order';
    try {
      const orderData = await createOrder(selectedPlan);
      phase = 'checkout';
      const paymentResult = await openRazorpay({
        key: CONFIG.RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'TricityMatch',
        description: `${selectedLabel} Plan`,
        order_id: orderData.orderId,
        prefill: { email: user?.email },
        theme: { color: c.primary },
      });
      verifyMutation.mutate({
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature,
      });
    } catch (e) {
      reportCheckoutFailure(e, phase, 'Subscribe', () => { void refetchPlans(); });
    } finally {
      setPaying(false);
    }
  };

  const payViaGooglePlay = async () => {
    if (unverified) return;
    purchaseLabel.current = selectedLabel;
    setPaying(true);
    setNotice(null);
    // Once Google Play has taken the purchase the member HAS been charged, so a
    // failure after this point must never say otherwise.
    let purchased: { productId: string; purchaseToken: string } | null = null;
    try {
      const { productId, purchaseToken } = await purchaseGooglePlaySubscription(selectedPlan);
      purchased = { productId, purchaseToken };
      await verifyGooglePlay({ productId, purchaseToken });
      await finishGooglePlayPurchase();
      await finishPlanPurchase();
    } catch (e) {
      const err = e as { message?: string; code?: string };
      if (purchased) {
        // Charged, and not activated: held (no second purchase can start), with a
        // retry that re-sends this same purchase and a route to support.
        setUnverified({ kind: 'play', ...purchased });
        setNotice({
          text: 'Google Play completed your purchase, but we could not activate the plan yet. Try again. If it keeps failing, contact support and we will sort it out.',
          actions: ['retry', 'support'],
        });
      } else if (err?.message === IAP_UNAVAILABLE) {
        setNotice({
          text: 'Google Play billing needs the Play Store build. Use Card / UPI, or subscribe on our website.',
          actions: ['website'],
        });
      } else if (err?.code === 'E_USER_CANCELLED') {
        tell.info('Purchase cancelled', 'No charge was made.');
      } else {
        setNotice({
          text: "Your purchase didn't complete. If Google Play shows a charge, contact support and we will sort it out.",
          actions: ['support'],
        });
      }
    } finally {
      setPaying(false);
    }
  };

  const payMethods = useMemo(() => {
    // Only offer methods that can actually complete. A chooser entry that always
    // ends in an error is non-functional UI, which store reviewers treat as a
    // rejection reason.
    const list: Array<{ label: string; value: PayMethod }> = [];
    if (CONFIG.IS_RAZORPAY_CONFIGURED) list.push({ label: 'Card / UPI (Razorpay)', value: 'razorpay' });
    if (playAvailable) list.push({ label: 'Google Play', value: 'play' });
    return list;
  }, [playAvailable]);

  // iOS always pays on the website. Android does too when this build has no
  // payable method: a CTA labelled "Subscribe" that can only end in an error is
  // non-functional UI, and the website is a checkout that works.
  const webCheckout = isIOS || payMethods.length === 0;

  const runMethod = (m: PayMethod) => (m === 'razorpay' ? payViaRazorpay() : payViaGooglePlay());

  // Android offers a payment-method choice (user-choice billing). iOS redirects.
  const handleSubscribe = () => {
    if (!canUpgrade || unverified) return;
    setNotice(null);
    if (webCheckout) {
      openWebsiteCheckout();
      return;
    }
    if (payMethods.length === 1) {
      runMethod(payMethods[0].value);
      return;
    }
    setMethodSheet(true);
  };

  // À-la-carte contact-unlock top-up. iOS → website; Android → Razorpay.
  const buyBundle = async (bundleId: string) => {
    if (isIOS) {
      openWebsiteCheckout();
      return;
    }
    if (unverified) return;
    setPaying(true);
    setNotice(null);
    let phase: 'order' | 'checkout' | 'verify' = 'order';
    // Kept outside the try so a failed confirmation can be held and re-sent.
    let payment: PaymentTriple | null = null;
    try {
      const order = await createBundleOrder(bundleId);
      phase = 'checkout';
      const bundle = (liveBundles ?? []).find((b) => b.bundleId === bundleId);
      const paymentResult = await openRazorpay({
        key: CONFIG.RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'TricityMatch',
        description: bundle?.label ?? 'Contact unlocks',
        order_id: order.orderId,
        prefill: { email: user?.email },
        theme: { color: c.primary },
      });
      phase = 'verify';
      payment = {
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature,
      };
      const { unlocks } = await verifyBundlePayment(payment);
      // Best effort: a top-up does not change the plan, so a failed re-read is
      // not something to interrupt a successful purchase for.
      await syncMember();
      tell.success('Unlocks added', `${unlocks} contact unlock${unlocks === 1 ? '' : 's'} credited.`);
    } catch (e) {
      if (phase === 'verify') {
        // Razorpay took the payment; only our side failed. Held, like a plan
        // (`payment` is always set by the time the phase reads 'verify').
        if (payment) setUnverified({ kind: 'bundle', payment });
        setNotice({ text: CHARGED_UNVERIFIED, actions: payment ? ['retry', 'support'] : ['support'] });
      } else {
        reportCheckoutFailure(e, phase, 'Buy unlocks', () => { void refetchBundles(); });
      }
    } finally {
      setPaying(false);
    }
  };

  const busy = paying || verifyMutation.isPending;
  // The path this buyer's money takes decides which terms are true. Razorpay (in
  // the app or on the website) is a one-time payment; a Google Play purchase is a
  // store subscription with its own renewal and refund terms, which this screen
  // does not state, so it says nothing about them rather than borrow ours.
  const razorpayPath = webCheckout || payMethods.some((m) => m.value === 'razorpay');
  const alsoPlay = !webCheckout && payMethods.some((m) => m.value === 'play');
  // Wording mirrors the footnote on the website's own plans page, which links the
  // same Refund Policy. The line ends in the link's name, drawn as the link.
  const termsLead = !razorpayPath
    ? null
    : alsoPlay
    ? 'Card / UPI is a one-time payment with no auto-renewal. 7-day refund window, see our'
    : 'One-time payment, no auto-renewal. 7-day refund window, see our';
  const minTap = elder ? tapSize(true) : undefined;
  // Button's own floor is 50pt; elder mode owes 60. It is the highest-value
  // control on the screen, so it carries the elder floor itself (the gradient
  // is centred in the taller box).
  const elderButton = minTap ? { minHeight: minTap, justifyContent: 'center' as const } : undefined;
  const actionSize = { minHeight: minTap ?? 44 };

  // The CTA says what it will do, or why it will not: never a price it is not
  // going to charge.
  const ctaTitle = unverified
    ? 'Payment not confirmed yet'
    : selectedPlan === currentPlan
    ? 'Current plan'
    : selectedPlan === 'free'
    ? 'Downgrade not available'
    : !canUpgrade
    ? 'Not available on your plan'
    : webCheckout
    ? 'Continue on our website'
    : `Subscribe to ${selectedLabel}`;

  return (
    <Screen edges={['top', 'bottom']} testID="SubscriptionScreen">
      <ScreenHeader title="Subscription" testID="SubscriptionScreen-header" />

      {/* Tab bar */}
      <View style={s.tabs} accessibilityRole="tablist">
        {(['plans', 'history'] as const).map((t2) => (
          <PressableScale
            key={t2}
            style={[s.tab, tab === t2 && s.tabActive, minTap ? { minHeight: minTap } : null]}
            onPress={() => setTab(t2)}
            testID={`tab-${t2}`}
            accessibilityLabel={t2 === 'plans' ? 'Plans' : 'History'}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t2 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color={tab === t2 ? 'primary' : 'textSecondary'}>
              {t2 === 'plans' ? 'Plans' : 'History'}
            </Text>
          </PressableScale>
        ))}
      </View>

      {tab === 'plans' ? (
        <>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* The heading depends on what the server sells, so it is only drawn
                once the catalogue is known: a title that reads "Choose your plan"
                while loading and then flips to "Go Premium" is copy jitter. */}
            {visiblePlans.length > 0 ? (
              <>
                <Text variant="title2" color="textPrimary" style={s.sectionTitle} accessibilityRole="header">
                  {paidPlans.length === 1 ? `Go ${paidPlans[0].label}` : 'Choose your plan'}
                </Text>
                <Text variant="footnote" color="textSecondary" style={s.sectionSub}>See what each plan includes.</Text>
              </>
            ) : null}

            {plansLoading ? (
              <PlanListSkeleton />
            ) : !plans ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't load plans"
                description="Check your connection and try again."
                actionLabel="Retry"
                onAction={() => refetchPlans()}
                variant="error"
                testID="plans-error"
              />
            ) : visiblePlans.length === 0 ? (
              <EmptyState
                icon="pricetag-outline"
                title="No plans available right now"
                description="Check back shortly, or try refreshing."
                actionLabel="Retry"
                onAction={() => refetchPlans()}
                testID="plans-empty"
              />
            ) : (
              // Iterate the SERVER's list, not PLAN_ORDER: a tier the offer
              // withdrew is absent from it, and the old `?? PLANS[planType]`
              // fallback re-materialised exactly that card at the regular
              // price — buyable in the UI, refused at checkout.
              <View accessibilityRole="radiogroup" accessibilityLabel="Plans">
                {visiblePlans.map((plan, planIdx) => {
                  const planType = plan.planType;
                  return (
                    <StaggeredEntrance key={planType} index={planIdx}>
                      <PlanCard
                        plan={plan}
                        rows={featureRows}
                        isCurrent={planType === currentPlan}
                        isSelected={planType === selectedPlan}
                        // One haptic, on the commit. The notice is NOT cleared here: an
                        // outcome the member has to act on stays until it is resolved or
                        // a new payment attempt starts.
                        onSelect={() => {
                          if (planType !== selectedPlan) haptics.light();
                          setSelectedPlan(planType);
                        }}
                        currency={currency}
                      />
                    </StaggeredEntrance>
                  );
                })}
              </View>
            )}

            {/* À-la-carte contact-unlock top-ups (finite paid plans only) */}
            {bundlesEligible && bundlesPayable && (bundlesLoading || bundlesError || (liveBundles?.length ?? 0) > 0) && (
              <View style={s.bundles}>
                <Text variant="headline" color="textPrimary" accessibilityRole="header">Need more contact unlocks?</Text>
                <Text variant="footnote" color="textSecondary" style={s.bundlesSub}>Top up without changing your plan.</Text>
                {bundlesLoading ? (
                  <View testID="bundles-loading">
                    <SkeletonBlock height={64} radius={borderRadius.md} style={s.bundleSkeleton} />
                    <SkeletonBlock height={64} radius={borderRadius.md} />
                  </View>
                ) : bundlesError && !liveBundles ? (
                  <View style={s.inlineError} testID="bundles-error">
                    <Ionicons
                      name="cloud-offline-outline"
                      size={18}
                      color={c.error}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                    <Text variant="footnote" color="textSecondary" style={s.inlineErrorText}>Couldn't load top-ups.</Text>
                    <PressableScale
                      onPress={() => refetchBundles()}
                      accessibilityRole="button"
                      accessibilityLabel="Try loading top-ups again"
                      style={[s.inlineAction, actionSize]}
                      testID="bundles-retry"
                      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text variant="subhead" color="primary">Try again</Text>
                    </PressableScale>
                  </View>
                ) : (
                  (liveBundles ?? []).map((b) => {
                    const local = formatLocalPrice(b.price, currency);
                    return (
                      <PressableScale
                        key={b.bundleId}
                        style={[
                          s.bundleRow,
                          { borderColor: c.border },
                          minTap ? { minHeight: minTap } : null,
                          unverified ? s.bundleRowHeld : null,
                        ]}
                        onPress={() => buyBundle(b.bundleId)}
                        disabled={busy || !!unverified}
                        testID={`bundle-${b.bundleId}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${b.label}, ₹${b.price.toLocaleString('en-IN')}`}
                        accessibilityHint={
                          unverified ? 'Not available while your last payment is being confirmed' : 'Double tap to buy'
                        }
                        accessibilityState={{ disabled: busy || !!unverified }}
                        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="lock-open-outline" size={20} color={c.accent} />
                        <View style={s.bundleText}>
                          <Text variant="headline" color="textPrimary">{b.label}</Text>
                          {local ? <Text variant="footnote" color="textSecondary" style={s.bundleLocal}>≈ {local} (charged in ₹)</Text> : null}
                        </View>
                        <Text variant="headline" color="primary">₹{b.price.toLocaleString('en-IN')}</Text>
                      </PressableScale>
                    );
                  })
                )}
              </View>
            )}

            {webCheckout && (
              <Text variant="footnote" color="textSecondary" style={s.iosNote}>
                Subscriptions are managed on tricitymatch.com. Tap below to continue in your browser.
              </Text>
            )}
          </ScrollView>

          {/* Subscribe CTA — only once there is a live catalogue to subscribe to.
              While plans load or fail, a footer would price a plan we have not seen.
              A notice is drawn regardless: an unresolved payment must not vanish
              because the catalogue behind it was just refetched. Bottom safe area
              is Screen's; the bar only owes its own padding. */}
          {visiblePlans.length > 0 || notice ? (
            <View style={s.footer}>
              {notice ? (
                <View style={s.notice} testID="pay-notice">
                  <View style={s.noticeBody}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={c.textSecondary}
                      style={s.noticeIcon}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                    <Text variant="footnote" color="textSecondary" style={s.noticeText}>{notice.text}</Text>
                  </View>
                  {/* Actions wrap onto their own row: two labels beside a paragraph
                      of hi/pa copy would otherwise squeeze the text to a sliver. */}
                  <View style={s.noticeActions}>
                    {notice.actions.map((a) => (
                      <PressableScale
                        key={a}
                        onPress={() => runNoticeAction(a)}
                        disabled={busy}
                        accessibilityRole={a === 'website' ? 'link' : 'button'}
                        accessibilityLabel={NOTICE_ACTION_COPY[a].a11y}
                        accessibilityState={{ disabled: busy }}
                        style={[s.inlineAction, actionSize]}
                        testID={`pay-notice-${a}`}
                        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text variant="subhead" color="primary">{NOTICE_ACTION_COPY[a].label}</Text>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              ) : null}
              {visiblePlans.length > 0 ? (
                <>
                  {canUpgrade && selectedLive && !unverified ? (
                    <View style={s.summary}>
                      <View style={s.summaryLeft}>
                        <Text variant="headline" color="fgStrong">{selectedLive.label}</Text>
                        {selectedLive.durationDays ? (
                          <Text variant="footnote" color="textSecondary">{selectedLive.durationDays} days</Text>
                        ) : null}
                      </View>
                      <Text variant="title3" color="fgStrong" style={s.summaryPrice}>
                        ₹{selectedLive.price.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ) : null}
                  <Button
                    title={ctaTitle}
                    onPress={handleSubscribe}
                    disabled={!canUpgrade || !!unverified}
                    loading={busy}
                    icon={webCheckout && canUpgrade && !unverified ? 'open-outline' : undefined}
                    style={elderButton}
                    testID="subscribe-btn"
                    accessibilityLabel={
                      canUpgrade && selectedLive && !unverified
                        ? `${ctaTitle}, ₹${selectedLive.price.toLocaleString('en-IN')}`
                        : ctaTitle
                    }
                  />
                  <Text variant="footnote" color="textSecondary" style={s.disclaimer}>
                    {webCheckout
                      ? 'You’ll finish checkout securely on tricitymatch.com'
                      : payMethods.length === 2
                        ? 'Pay by Card / UPI (Razorpay) or Google Play'
                        : payMethods[0].value === 'razorpay'
                          ? 'Pay by Card / UPI (Razorpay)'
                          : 'Pay with Google Play'}
                  </Text>
                  {termsLead ? (
                    <PressableScale
                      onPress={openRefundPolicy}
                      accessibilityRole="link"
                      accessibilityLabel={`${termsLead} Refund Policy. Opens our website.`}
                      style={[s.termsLink, actionSize]}
                      testID="refund-policy-link"
                      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text variant="footnote" color="textSecondary" style={s.termsText}>
                        {termsLead}{' '}
                        <Text variant="footnote" color="primary" style={s.termsLinkText}>Refund Policy</Text>.
                      </Text>
                    </PressableScale>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text variant="title2" color="textPrimary" style={s.sectionTitle} accessibilityRole="header">Payment history</Text>
          {histLoading ? (
            <ListSkeleton rows={5} />
          ) : !history ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load payment history"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetchHistory()}
              variant="error"
              testID="SubscriptionScreen-error"
            />
          ) : history.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No payments yet"
              description="Your plan purchases will show up here."
              actionLabel="See plans"
              onAction={() => setTab('plans')}
              testID="history-empty"
            />
          ) : (
            history.map((sub) => <HistoryItem key={sub.id} sub={sub} />)
          )}
        </ScrollView>
      )}

      <PickerSheet<PayMethod>
        visible={methodSheet}
        title={`Pay for ${selectedLabel}`}
        options={payMethods}
        selected={null}
        onSelect={(v) => runMethod(v as PayMethod)}
        onClose={() => setMethodSheet(false)}
      />
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  tabs:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border },
  // The indicator is always 2pt (transparent when inactive) so switching tabs
  // does not change the row's height.
  tab:          { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:    { borderBottomColor: c.primary },
  scroll:       { flex: 1 },
  // The footer is a sibling of the scroller, not an overlay, so no clearance
  // constant is owed to it.
  scrollContent:{ padding: spacing.lg, paddingBottom: spacing['2xl'] },
  sectionTitle: { marginBottom: spacing.xs },
  sectionSub:   { marginBottom: spacing.xl },
  footer:       { padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background },
  summary:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md },
  summaryLeft:  { flex: 1 },
  summaryPrice: { flexShrink: 0 },
  disclaimer:   { textAlign: 'center', marginTop: spacing.sm },
  // the whole line is the link, so it is a full-width target of at least 44pt
  termsLink:    { justifyContent: 'center', alignItems: 'center' },
  termsText:    { textAlign: 'center' },
  termsLinkText:{ textDecorationLine: 'underline' },
  notice:       { gap: spacing.xs, backgroundColor: c.surface2, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  noticeBody:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  // lines the icon up with the first line of the 18pt-leading footnote
  noticeIcon:   { marginTop: 1 },
  noticeText:   { flex: 1 },
  noticeActions:{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: spacing.sm },
  // 44pt tall by padding, so it needs no hitSlop marker
  inlineAction: { minHeight: 44, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  inlineError:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.surface2, borderRadius: borderRadius.md, paddingLeft: spacing.md },
  inlineErrorText: { flex: 1 },
  bundles:      { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: c.border },
  bundlesSub:   { marginBottom: spacing.md },
  bundleSkeleton: { marginBottom: spacing.sm },
  bundleRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  // dimmed like a disabled Button while a payment is awaiting confirmation
  bundleRowHeld:{ opacity: 0.45 },
  bundleText:   { flex: 1 },
  bundleLocal:  { marginTop: 1 },
  iosNote:      { textAlign: 'center', marginTop: spacing.lg },
});
