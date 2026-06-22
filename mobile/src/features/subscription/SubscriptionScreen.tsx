import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { PLANS, PLAN_ORDER } from '@shared/constants/plans';
import { getPlans, createOrder, verifyPayment, getSubscriptionHistory } from '../../api/subscription';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import type { MainStackParamList } from '../../navigation/types';
import type { PlanFeatures, SubscriptionPlanType } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

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

async function openRazorpay(options: RazorpayOptions): Promise<{
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RazorpayCheckout = require('react-native-razorpay').default;
    return await RazorpayCheckout.open(options);
  } catch {
    // Not installed (Expo Go / dev) — return stub
    return {
      razorpay_payment_id: 'pay_DEV_STUB',
      razorpay_order_id: options.order_id,
      razorpay_signature: 'DEV_STUB_SIG',
    };
  }
}

// ─── Plan tier colours ────────────────────────────────────────────────────────

const PLAN_COLOUR: Record<SubscriptionPlanType, string> = {
  free:          colours.planFree,
  basic_premium: colours.planPlus,
  premium_plus:  colours.planPremium,
  vip:           colours.planElite,
};

const PLAN_ICON: Record<SubscriptionPlanType, keyof typeof Ionicons.glyphMap> = {
  free:          'person-outline',
  basic_premium: 'star-outline',
  premium_plus:  'diamond-outline',
  vip:           'trophy-outline',
};

// ─── Feature row ─────────────────────────────────────────────────────────────

function FeatureRow({ label, value }: { label: string; value: boolean | string | number | null }) {
  const tick = value === true || (typeof value === 'number' && value > 0) || typeof value === 'string';
  return (
    <View style={fr.row}>
      <Ionicons
        name={tick ? 'checkmark-circle' : 'close-circle'}
        size={16}
        color={tick ? colours.success : colours.textMuted}
        style={fr.icon}
      />
      <Text style={fr.label}>{label}</Text>
      {typeof value === 'number' && value > 0 && (
        <Text style={fr.val}>{value}</Text>
      )}
      {typeof value === 'string' && (
        <Text style={fr.val}>{value}</Text>
      )}
    </View>
  );
}

const fr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  icon:  { marginRight: 8 },
  label: { flex: 1, fontSize: typography.fontSize.sm, color: colours.textSecondary, fontFamily: typography.fontFamily.regular },
  val:   { fontSize: typography.fontSize.sm, color: colours.textPrimary, fontFamily: typography.fontFamily.semiBold },
});

// ─── Plan Card ────────────────────────────────────────────────────────────────

// Which plan to spotlight, mirroring the web (premium_plus = Most Popular, vip = Best Value).
const PLAN_HIGHLIGHT: Partial<Record<SubscriptionPlanType, string>> = {
  premium_plus: 'Most Popular',
  vip:          'Best Value',
};

interface PlanCardProps {
  plan: PlanFeatures;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function PlanCard({ plan, isCurrent, isSelected, onSelect }: PlanCardProps) {
  const colour = PLAN_COLOUR[plan.planType];
  const icon = PLAN_ICON[plan.planType];
  const highlight = PLAN_HIGHLIGHT[plan.planType];

  return (
    <TouchableOpacity
      style={[
        pc.card,
        highlight ? { marginTop: spacing.lg } : null,
        isSelected && pc.cardSelected,
        { borderColor: isSelected || highlight ? colour : colours.border },
      ]}
      onPress={onSelect}
      testID={`plan-card-${plan.planType}`}
      accessibilityLabel={`Select ${plan.label} plan`}
      accessibilityRole="button"
    >
      {highlight && (
        <View style={[pc.highlightBadge, { backgroundColor: colour }]}>
          <Text style={pc.highlightText}>{highlight}</Text>
        </View>
      )}
      {isCurrent && (
        <View style={[pc.badge, { backgroundColor: colour }]}>
          <Text style={pc.badgeText}>Current</Text>
        </View>
      )}
      <View style={pc.header}>
        <Ionicons name={icon} size={26} color={colour} style={pc.icon} />
        <View style={pc.titleCol}>
          <Text style={[pc.label, { color: colour }]}>{plan.label}</Text>
          {plan.price > 0 ? (
            <Text style={pc.price}>
              ₹{plan.price.toLocaleString('en-IN')}
              <Text style={pc.dur}>{plan.durationDays ? ` / ${plan.durationDays} days` : ''}</Text>
            </Text>
          ) : (
            <Text style={pc.price}>Free</Text>
          )}
        </View>
        {isSelected && <Ionicons name="checkmark-circle" size={22} color={colour} />}
      </View>

      <View style={pc.divider} />

      <FeatureRow label="Chat with matches" value={plan.canChat} />
      <FeatureRow label="See who liked me" value={plan.canSeeWhoLikedMe} />
      <FeatureRow label="Voice & video calls" value={plan.canMakeVoiceVideoCalls} />
      <FeatureRow label="Advanced filters" value={plan.canUseAdvancedFilters} />
      <FeatureRow label="Profile boost" value={plan.canBoostProfile} />
      <FeatureRow label="Relationship manager" value={plan.hasRelationshipManager} />
      {plan.contactUnlocks !== null && (
        <FeatureRow
          label="Contact unlocks"
          value={plan.contactUnlocks === null ? 'Unlimited' : plan.contactUnlocks}
        />
      )}
      {plan.contactUnlocks === null && plan.planType === 'vip' && (
        <FeatureRow label="Contact unlocks" value="Unlimited" />
      )}
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colours.background,
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: colours.primaryLight,
    shadowColor: colours.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: spacing.lg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: borderRadius.sm,
    borderBottomRightRadius: borderRadius.sm,
  },
  badgeText: { fontSize: typography.fontSize.xs, color: '#fff', fontFamily: typography.fontFamily.semiBold },
  highlightBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    width: 110,
    marginLeft: -55,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  highlightText: { fontSize: typography.fontSize.xs, color: '#fff', fontFamily: typography.fontFamily.bold, letterSpacing: 0.3 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  icon:      { fontSize: 28 },
  titleCol:  { flex: 1 },
  label:     { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  price:     { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary, marginTop: 2 },
  dur:       { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, color: colours.textSecondary },
  divider:   { height: 1, backgroundColor: colours.border, marginVertical: spacing.sm },
});

// ─── History Item ─────────────────────────────────────────────────────────────

function HistoryItem({ sub }: { sub: import('../../types').Subscription }) {
  const colour = PLAN_COLOUR[sub.planType];
  const label = PLANS[sub.planType]?.label ?? sub.planType;
  const date = sub.startDate ? new Date(sub.startDate).toLocaleDateString('en-IN') : '—';
  const amount = sub.amount ? `₹${sub.amount.toLocaleString('en-IN')}` : 'Free';
  return (
    <View style={hi.row} testID={`history-item-${sub.id}`}>
      <View style={[hi.dot, { backgroundColor: colour }]} />
      <View style={hi.info}>
        <Text style={hi.plan}>{label}</Text>
        <Text style={hi.date}>{date} · {amount}</Text>
      </View>
      <View style={[hi.statusBadge, sub.status === 'active' ? hi.statusActive : hi.statusInactive]}>
        <Text style={hi.statusText}>{sub.status}</Text>
      </View>
    </View>
  );
}

const hi = StyleSheet.create({
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colours.border },
  dot:            { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  info:           { flex: 1 },
  plan:           { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  date:           { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginTop: 2 },
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  statusActive:   { backgroundColor: colours.success + '20' },
  statusInactive: { backgroundColor: colours.border },
  statusText:     { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, color: colours.textSecondary, textTransform: 'capitalize' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const currentPlan = (user?.subscriptionPlan ?? 'free') as SubscriptionPlanType;
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanType>(currentPlan);
  const [tab, setTab] = useState<'plans' | 'history'>('plans');
  const [paying, setPaying] = useState(false);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: queryKeys.plans,
    queryFn: getPlans,
    staleTime: 10 * 60 * 1000,
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: queryKeys.subscription,
    queryFn: getSubscriptionHistory,
    enabled: tab === 'history',
  });

  const verifyMutation = useMutation({
    mutationFn: verifyPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
      Alert.alert('Success!', `${PLANS[selectedPlan].label} plan activated. Enjoy!`);
      navigation.goBack();
    },
    onError: () => {
      Alert.alert('Verification Failed', 'Payment could not be verified. Contact support if amount was deducted.');
    },
  });

  const handleSubscribe = async () => {
    if (selectedPlan === 'free' || selectedPlan === currentPlan) return;
    setPaying(true);
    try {
      const orderData = await createOrder(selectedPlan);
      const paymentResult = await openRazorpay({
        key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '',
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'TricityShadi',
        description: `${PLANS[selectedPlan].label} Plan`,
        order_id: orderData.orderId,
        prefill: { email: user?.email },
        theme: { color: colours.primary },
      });
      verifyMutation.mutate({
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature,
      });
    } catch {
      Alert.alert('Payment Cancelled', 'No charge was made.');
    } finally {
      setPaying(false);
    }
  };

  const canUpgrade = selectedPlan !== 'free' && selectedPlan !== currentPlan;
  const planList = (plans ?? Object.values(PLANS)) as PlanFeatures[];

  return (
    <View style={[s.wrapper, { paddingTop: insets.top }]} testID="SubscriptionScreen">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabs}>
        {(['plans', 'history'] as const).map((t2) => (
          <TouchableOpacity
            key={t2}
            style={[s.tab, tab === t2 && s.tabActive]}
            onPress={() => setTab(t2)}
            testID={`tab-${t2}`}
            accessibilityLabel={t2 === 'plans' ? 'Plans tab' : 'History tab'}
            accessibilityRole="tab"
          >
            <Text style={[s.tabText, tab === t2 && s.tabTextActive]}>
              {t2 === 'plans' ? 'Plans' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'plans' ? (
        <>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.sectionTitle}>Choose your plan</Text>
            <Text style={s.sectionSub}>Upgrade to find your perfect match faster</Text>

            {plansLoading ? (
              <ActivityIndicator size="large" color={colours.primary} style={{ marginTop: 40 }} />
            ) : (
              PLAN_ORDER.map((planType) => {
                const plan = planList.find((p) => p.planType === planType) ?? PLANS[planType];
                return (
                  <PlanCard
                    key={planType}
                    plan={plan}
                    isCurrent={planType === currentPlan}
                    isSelected={planType === selectedPlan}
                    onSelect={() => setSelectedPlan(planType)}
                  />
                );
              })
            )}
          </ScrollView>

          {/* Subscribe CTA */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.cta, !canUpgrade && s.ctaDisabled]}
              onPress={handleSubscribe}
              disabled={!canUpgrade || paying || verifyMutation.isPending}
              testID="subscribe-btn"
              accessibilityLabel={canUpgrade ? `Subscribe to ${PLANS[selectedPlan].label}` : 'Already on this plan'}
            >
              {(paying || verifyMutation.isPending) ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.ctaText}>
                  {selectedPlan === currentPlan
                    ? 'Current Plan'
                    : selectedPlan === 'free'
                    ? 'Downgrade not available'
                    : `Subscribe to ${PLANS[selectedPlan].label} — ₹${PLANS[selectedPlan].price.toLocaleString('en-IN')}`}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={s.disclaimer}>Payments processed securely via Razorpay</Text>
          </View>
        </>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionTitle}>Payment History</Text>
          {histLoading ? (
            <ActivityIndicator size="large" color={colours.primary} style={{ marginTop: 40 }} />
          ) : !history?.length ? (
            <View style={s.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={colours.textMuted} />
              <Text style={s.emptyText}>No payments yet</Text>
            </View>
          ) : (
            history.map((sub) => <HistoryItem key={sub.id} sub={sub} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:      { flex: 1, backgroundColor: colours.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing['3xl'], paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colours.border },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  tabs:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colours.border },
  tab:          { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: colours.primary },
  tabText:      { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.medium, color: colours.textMuted },
  tabTextActive:{ color: colours.primary },
  scroll:       { flex: 1 },
  scrollContent:{ padding: spacing.lg, paddingBottom: 120 },
  sectionTitle: { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.xs },
  sectionSub:   { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginBottom: spacing.xl },
  footer:       { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colours.border, backgroundColor: colours.background },
  cta:          { backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.lg, alignItems: 'center' },
  ctaDisabled:  { backgroundColor: colours.textMuted },
  ctaText:      { color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.bold },
  disclaimer:   { fontSize: typography.fontSize.xs, color: colours.textMuted, textAlign: 'center', marginTop: spacing.sm },
  emptyState:   { alignItems: 'center', paddingTop: spacing['5xl'], gap: spacing.md },
  emptyText:    { fontSize: typography.fontSize.base, color: colours.textMuted },
});
