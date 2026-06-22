import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getBgCheckStatus, initiateBgCheck, verifyBgCheckPayment } from '../../api/verification';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// Dynamic Razorpay require — no-op in Expo Go
async function openRazorpay(orderId: string, amountPaise: number, email: string): Promise<{
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
} | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RazorpayCheckout = require('react-native-razorpay').default;
    const result = await RazorpayCheckout.open({
      key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '',
      order_id: orderId,
      amount: amountPaise,
      currency: 'INR',
      name: 'TricityShadi',
      description: 'Background & Marital Status Check',
      prefill: { email },
    });
    return result;
  } catch {
    return null;
  }
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  not_requested: { label: 'Not started',    color: colours.textSecondary, icon: 'ellipse-outline' },
  pending_payment: { label: 'Awaiting payment', color: colours.warning,   icon: 'time-outline' },
  in_progress:   { label: 'In progress',    color: colours.primary,        icon: 'sync-outline' },
  passed:        { label: 'Passed',         color: colours.success,        icon: 'checkmark-circle' },
  failed:        { label: 'Failed',         color: colours.error,          icon: 'close-circle' },
};

export const BackgroundCheckScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [consentChecked, setConsentChecked] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['bgCheckStatus'],
    queryFn: getBgCheckStatus,
    // Poll every 15s while in_progress so user sees update without manual refresh
    refetchInterval: (query) =>
      query.state.data?.bgCheckStatus === 'in_progress' ? 15000 : false,
  });

  // Refresh on foreground resume — user may have completed an external provider flow
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        refetch();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [refetch]);

  const initiateMutation = useMutation({
    mutationFn: initiateBgCheck,
    onSuccess: async (data) => {
      if (data.razorpayOrderId) {
        // Open Razorpay checkout
        const payResult = await openRazorpay(data.razorpayOrderId, data.amountPaise, '');
        if (payResult) {
          await verifyMutation.mutateAsync(payResult);
        } else {
          Alert.alert('Payment cancelled', 'Your background check request was saved. Complete payment to proceed.');
        }
      } else {
        // Dev mode — no payment needed
        queryClient.invalidateQueries({ queryKey: ['bgCheckStatus'] });
        Alert.alert('Background check initiated', 'Processing in dev mode (no payment required).');
      }
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: verifyBgCheckPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bgCheckStatus'] });
      Alert.alert('Payment confirmed', 'Your background check is now in progress. We\'ll notify you when complete.');
    },
    onError: (err: Error) => Alert.alert('Payment failed', err.message),
  });

  const handleStart = () => {
    if (!consentChecked) {
      Alert.alert('Consent required', 'Please agree to the terms before proceeding.');
      return;
    }
    Alert.alert(
      'Confirm Background Check',
      'This will initiate a background and marital status check for ₹499. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', onPress: () => initiateMutation.mutate() },
      ]
    );
  };

  const cfg = STATUS_LABELS[status?.bgCheckStatus ?? 'not_requested'];
  const isCompleted = status?.bgCheckStatus === 'passed' || status?.bgCheckStatus === 'failed';
  const isPending = status?.bgCheckStatus === 'in_progress' || status?.bgCheckStatus === 'pending_payment';
  const isBusy = initiateMutation.isPending || verifyMutation.isPending;

  return (
    <View style={[s.wrapper, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Background Check</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Status badge */}
        {!isLoading && (
          <View style={[s.statusBadge, { borderColor: cfg.color + '60', backgroundColor: cfg.color + '10' }]}>
            <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
            <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        )}

        {/* Hero */}
        <View style={s.hero}>
          <Ionicons name="shield-checkmark" size={48} color={colours.primary} />
          <Text style={s.heroTitle}>Background & Marital Status Check</Text>
          <Text style={s.heroSub}>
            Verify your background to build trust. Checked against court records and marital status databases.
            Adds a <Text style={s.bold}>Background Verified</Text> badge to your profile.
          </Text>
        </View>

        {/* What's checked */}
        <View style={s.card}>
          <Text style={s.cardTitle}>What gets checked</Text>
          {[
            { icon: 'document-text-outline', text: 'Court records & criminal history' },
            { icon: 'heart-dislike-outline', text: 'Marital status verification' },
            { icon: 'person-outline',        text: 'Identity cross-check' },
          ].map((item) => (
            <View key={item.text} style={s.checkRow}>
              <Ionicons name={item.icon as any} size={18} color={colours.primary} />
              <Text style={s.checkText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Passed result */}
        {status?.bgCheckStatus === 'passed' && (
          <View style={[s.card, s.passedCard]}>
            <Ionicons name="checkmark-circle" size={28} color={colours.success} />
            <Text style={s.passedTitle}>Background Check Passed</Text>
            <Text style={s.passedSub}>Your profile now displays the Background Verified badge.</Text>
          </View>
        )}

        {/* Failed result */}
        {status?.bgCheckStatus === 'failed' && (
          <View style={[s.card, s.failedCard]}>
            <Ionicons name="close-circle" size={28} color={colours.error} />
            <Text style={s.failedTitle}>Check did not pass</Text>
            <Text style={s.failedSub}>Contact support if you believe this is an error.</Text>
          </View>
        )}

        {/* In progress */}
        {status?.bgCheckStatus === 'in_progress' && (
          <View style={s.card}>
            <ActivityIndicator color={colours.primary} />
            <Text style={s.progressText}>Verification in progress — we'll notify you when complete.</Text>
          </View>
        )}

        {/* Consent + CTA */}
        {!isCompleted && !isPending && (
          <>
            <TouchableOpacity
              style={s.consentRow}
              onPress={() => setConsentChecked(v => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentChecked }}
            >
              <View style={[s.checkbox, consentChecked && s.checkboxChecked]}>
                {consentChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={s.consentText}>
                I consent to TricityShadi running a background and marital status check on my behalf, and agree to the{' '}
                <Text style={s.link}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.cta, (!consentChecked || isBusy) && s.ctaDisabled]}
              onPress={handleStart}
              disabled={!consentChecked || isBusy}
              accessibilityLabel="Start background check for ₹499"
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                  <Text style={s.ctaText}>Start Check — ₹499</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {status?.bgCheckStatus === 'pending_payment' && (
          <Text style={s.pendingHint}>Complete payment to proceed with the background check.</Text>
        )}
      </ScrollView>
    </View>
  );
};

const txt = {
  h2:        { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold } as const,
  h3:        { fontSize: typography.fontSize.lg,    fontFamily: typography.fontFamily.semiBold } as const,
  body:      { fontSize: typography.fontSize.base,  fontFamily: typography.fontFamily.regular } as const,
  bodySmall: { fontSize: typography.fontSize.sm,    fontFamily: typography.fontFamily.regular } as const,
};

const s = StyleSheet.create({
  wrapper:       { flex: 1, backgroundColor: colours.background },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colours.surfaceCard, borderBottomWidth: 1, borderBottomColor: colours.border },
  headerTitle:   { ...txt.h3, color: colours.textPrimary },
  body:          { padding: spacing.lg, gap: spacing.md },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center', borderWidth: 1, borderRadius: borderRadius.full, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  statusText:    { ...txt.bodySmall, fontWeight: '600' },
  hero:          { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  heroTitle:     { ...txt.h2, color: colours.textPrimary, textAlign: 'center' },
  heroSub:       { ...txt.body, color: colours.textSecondary, textAlign: 'center' },
  bold:          { fontWeight: '700', color: colours.textPrimary },
  card:          { backgroundColor: colours.surfaceCard, borderRadius: borderRadius.md, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colours.border },
  cardTitle:     { ...txt.h3, color: colours.textPrimary, marginBottom: spacing.xs },
  checkRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkText:     { ...txt.body, color: colours.textSecondary, flex: 1 },
  passedCard:    { borderColor: colours.success + '60', backgroundColor: colours.success + '08', alignItems: 'center' },
  passedTitle:   { ...txt.h3, color: colours.success },
  passedSub:     { ...txt.body, color: colours.textSecondary, textAlign: 'center' },
  failedCard:    { borderColor: colours.error + '60', backgroundColor: colours.error + '08', alignItems: 'center' },
  failedTitle:   { ...txt.h3, color: colours.error },
  failedSub:     { ...txt.body, color: colours.textSecondary, textAlign: 'center' },
  progressText:  { ...txt.body, color: colours.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  consentRow:    { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  checkbox:      { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colours.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: colours.primary },
  consentText:   { ...txt.bodySmall, color: colours.textSecondary, flex: 1 },
  link:          { color: colours.primary },
  cta:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md },
  ctaDisabled:   { opacity: 0.5 },
  ctaText:       { ...txt.body, color: '#fff', fontWeight: '700' },
  pendingHint:   { ...txt.bodySmall, color: colours.warning, textAlign: 'center' },
});

export default BackgroundCheckScreen;
