import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { useOnboarding } from './OnboardingContext';
import { useAuthStore } from '../../stores/authStore';
import type { RootStackParamList } from '../../navigation/types';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

const RING_SIZE = 140;
const RING_THICKNESS = 10;
const COMPLETION_PERCENTAGE = 72; // base onboarding completion

const NEXT_STEPS = [
  {
    icon: 'shield-checkmark-outline' as const,
    titleKey: 'onboarding.step14.card1Title',
    subtitleKey: 'onboarding.step14.card1Sub',
    colour: colours.info,
  },
  {
    icon: 'person-outline' as const,
    titleKey: 'onboarding.step14.card2Title',
    subtitleKey: 'onboarding.step14.card2Sub',
    colour: colours.warning,
  },
  {
    icon: 'document-text-outline' as const,
    titleKey: 'onboarding.step14.card3Title',
    subtitleKey: 'onboarding.step14.card3Sub',
    colour: colours.success,
  },
];

export default function Step14Screen() {
  const { t } = useTranslation();
  const { saveAndNext } = useOnboarding();
  const navigation = useNavigation<RootNav>();
  const { setUser, user } = useAuthStore();

  // Animated scale for the ring entrance
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(progressAnim, {
        toValue: COMPLETION_PERCENTAGE,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const handleBrowse = async () => {
    // Mark onboarding complete in user store
    if (user) {
      setUser({ ...user, onboardingComplete: true });
    }
    // Persist the authoritative completion flag so a returning user isn't sent back
    // through onboarding on the next cold start (non-blocking).
    await saveAndNext({}, { onboardingComplete: true } as any).catch(() => {});
    // RootNavigator picks up onboardingComplete=true and renders MainNavigator
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  // Build the ring arc visually using a View with overflow:hidden trick
  const circumference = Math.PI * (RING_SIZE - RING_THICKNESS);
  const ringFill = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, circumference],
  });

  return (
    <SafeAreaView style={styles.safe} testID="OnboardingStep14">
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar (full) */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>

        {/* Completion ring */}
        <Animated.View style={[styles.ringWrapper, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}>
          <View style={styles.ring}>
            {/* Background circle */}
            <View style={styles.ringTrack} />
            {/* Completion percentage text */}
            <View style={styles.ringInner}>
              <Animated.Text style={styles.ringPercent}>
                {progressAnim.interpolate({ inputRange: [0, COMPLETION_PERCENTAGE], outputRange: ['0%', `${COMPLETION_PERCENTAGE}%`] })}
              </Animated.Text>
              <Text style={styles.ringLabel}>{t('onboarding.step14.complete')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Heading */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.title}>{t('onboarding.step14.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.step14.subtitle')}</Text>
        </Animated.View>

        {/* Next step cards */}
        <View style={styles.cards}>
          {NEXT_STEPS.map((card, i) => (
            <View key={i} style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: card.colour + '20' }]}>
                <Ionicons name={card.icon} size={24} color={card.colour} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{t(card.titleKey)}</Text>
                <Text style={styles.cardSub}>{t(card.subtitleKey)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colours.textMuted} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleBrowse}
          testID="btn-browseMatches"
          accessibilityLabel={t('onboarding.step14.browseMatches')}
        >
          <Text style={styles.primaryBtnText}>{t('onboarding.step14.browseMatches')}</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: spacing.sm }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  flex: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    alignItems: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: colours.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    width: '100%',
    marginBottom: spacing['3xl'],
  },
  progressFill: {
    height: '100%',
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
  },
  ringWrapper: {
    marginBottom: spacing['2xl'],
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_THICKNESS,
    borderColor: colours.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderTopColor: colours.primary,
    borderRightColor: colours.primary,
    borderBottomColor: colours.primary,
    // Arc-style: show partial fill using border colours
    // For a proper arc animation we'd use react-native-svg, but
    // this gives a clean visual within SDK 41 constraints
  },
  ringTrack: {
    position: 'absolute',
    width: RING_SIZE - RING_THICKNESS * 2,
    height: RING_SIZE - RING_THICKNESS * 2,
    borderRadius: (RING_SIZE - RING_THICKNESS * 2) / 2,
    backgroundColor: colours.primaryLight,
  },
  ringInner: { alignItems: 'center', zIndex: 1 },
  ringPercent: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
  },
  ringLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colours.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  cards: { width: '100%', gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    backgroundColor: colours.surfaceCard,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: typography.fontSize.xs,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.regular,
    lineHeight: typography.fontSize.xs * 1.5,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colours.border,
    backgroundColor: colours.background,
  },
  primaryBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
  },
});
