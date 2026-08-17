import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, type, spacing, borderRadius } from '@shared/constants/theme';
import { duration, easing } from '@shared/constants/motion';
import { Button } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { useReduceMotion } from '../../components/motion';
import { useOnboarding } from './OnboardingContext';

const TOTAL_STEPS = 14;

interface OnboardingLayoutProps {
  step: number;
  title: string;
  subtitle?: string;
  onContinue: () => void;
  continueDisabled?: boolean;
  skippable?: boolean;
  onSkip?: () => void;
  children: React.ReactNode;
}

export default function OnboardingLayout({
  step,
  title,
  subtitle,
  onContinue,
  continueDisabled = false,
  skippable = false,
  onSkip,
  children,
}: OnboardingLayoutProps) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const { goBack, isSaving } = useOnboarding();
  const reduced = useReduceMotion();
  const progress = Math.max(0, Math.min(1, step / TOTAL_STEPS));

  // Animated progress fill: measure the track once, then spring the fill width
  // to the new step so the bar glides instead of jumping. Reduce-motion jumps.
  const [trackW, setTrackW] = useState(0);
  const fillW = useSharedValue(0);
  const fillStyle = useAnimatedStyle(() => ({ width: fillW.value }));
  const onTrackLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);
  React.useEffect(() => {
    const target = trackW * progress;
    fillW.value = reduced
      ? target
      : withTiming(target, { duration: duration.slow, easing: Easing.bezier(...easing.std) });
  }, [trackW, progress, reduced, fillW]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} testID={`OnboardingStep${step}`}>
      {/* Header */}
      <View style={styles.header}>
        {step > 1 ? (
          <TouchableOpacity onPress={goBack} style={styles.backBtn} testID="btn-back" accessibilityLabel={t('common.back')}>
            <Ionicons name="arrow-back" size={24} color={c.fgStrong} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
        <Text style={[styles.stepLabel, { color: c.textMuted }]}>
          {t('onboarding.progress', { current: step, total: TOTAL_STEPS })}
        </Text>
        {skippable ? (
          <TouchableOpacity onPress={onSkip} testID="btn-skip" accessibilityLabel={t('common.skip')}>
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: c.surface2 }]} onLayout={onTrackLayout}>
        <Animated.View style={[styles.progressFill, fillStyle]} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: c.fgStrong }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text> : null}
          <View style={styles.content}>{children}</View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: c.hairline, backgroundColor: c.background }]}>
          <Button
            title={t('onboarding.saveAndContinue')}
            onPress={onContinue}
            loading={isSaving}
            disabled={continueDisabled}
            size="lg"
            testID="btn-continue"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colours.background,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { ...type.subhead, color: colours.textMuted },
  headerRight: { width: 40 },
  skipText: { ...type.subhead, color: colours.accent },
  progressTrack: {
    height: 6,
    backgroundColor: colours.surface2,
    marginHorizontal: spacing.gutter,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colours.accent,
    borderRadius: borderRadius.pill,
  },
  scrollContent: { padding: spacing.gutter, paddingBottom: spacing['3xl'] },
  title: {
    ...type.title1,
    fontFamily: 'PlayfairDisplay-Bold',
    color: colours.fgStrong,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: { ...type.body, color: colours.textMuted, marginBottom: spacing['2xl'] },
  content: { gap: spacing.lg },
  footer: {
    padding: spacing.gutter,
    borderTopWidth: 0.5,
    borderTopColor: colours.hairline,
  },
});
