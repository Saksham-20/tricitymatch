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
import { colours, type, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { duration, easing } from '@shared/constants/motion';
import { Button } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { useReduceMotion } from '../../components/motion';
import { useOnboarding, chapterForStep, JOURNEY_CHAPTERS, JOURNEY_ENDOWED_PROGRESS } from './OnboardingContext';

interface OnboardingLayoutProps {
  /** Kept for testIDs; progress derives from the journey context. */
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
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { goBack, exit, isSaving, currentStep, stepCount } = useOnboarding();
  const reduced = useReduceMotion();

  // Chapters, not step numbers: the header names where you are, the bar shows
  // how far. Endowed-progress credit — signup already covered the basics, so
  // the journey never starts from an empty bar (Nunes & Drèze).
  const chapter = chapterForStep(currentStep);
  const journeyFraction = Math.max(0, Math.min(1, (currentStep + 1) / stepCount));
  const progress = JOURNEY_ENDOWED_PROGRESS + (1 - JOURNEY_ENDOWED_PROGRESS) * journeyFraction;

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

  // Warm one-liner at the top of each new chapter (skip the very first).
  const chapterDoneLine =
    chapter.isChapterStart && chapter.chapterIndex > 0
      ? t(`journey.chapterDone.${JOURNEY_CHAPTERS[chapter.chapterIndex - 1].i18nKey}`, '')
      : currentStep === 0
        ? t('journey.endowed', "You're already a quarter done — signup covered the basics.")
        : '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} testID={`OnboardingStep${step}`}>
      {/* Header */}
      <View style={styles.header}>
        {currentStep > 0 ? (
          <TouchableOpacity onPress={goBack} style={styles.backBtn} testID="btn-back" accessibilityLabel={t('common.back')}>
            <Ionicons name="arrow-back" size={24} color={c.fgStrong} />
          </TouchableOpacity>
        ) : (
          // First journey screen: journey is skippable — close returns to Main.
          <TouchableOpacity onPress={exit} style={styles.backBtn} testID="btn-close" accessibilityLabel={t('common.close', 'Close')}>
            <Ionicons name="close" size={24} color={c.fgStrong} />
          </TouchableOpacity>
        )}
        <Text style={[styles.stepLabel, { color: c.textMuted }]}>
          {t(`journey.chapters.${chapter.i18nKey}`, chapter.fallback)}
        </Text>
        {skippable ? (
          <TouchableOpacity onPress={onSkip} testID="btn-skip" accessibilityLabel={t('common.skip')}>
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* Progress bar + chapter dots (no numerals — chapters orient instead) */}
      <View style={[styles.progressTrack, { backgroundColor: c.surface2 }]} onLayout={onTrackLayout}>
        <Animated.View style={[styles.progressFill, fillStyle]} />
      </View>
      <View style={styles.dotRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {JOURNEY_CHAPTERS.map((ch, i) => (
          <View
            key={ch.i18nKey}
            style={[
              styles.chapterDot,
              { backgroundColor: i < chapter.chapterIndex ? c.accent : i === chapter.chapterIndex ? c.accent : c.surface2 },
              i === chapter.chapterIndex && styles.chapterDotActive,
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {chapterDoneLine ? (
            <View style={[styles.chapterDone, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="checkmark-circle" size={15} color={c.accent} />
              <Text style={[styles.chapterDoneText, { color: c.accent }]}>{chapterDoneLine}</Text>
            </View>
          ) : null}
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

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
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
  stepLabel: { ...type.subhead, color: c.textMuted },
  headerRight: { width: 40 },
  skipText: { ...type.subhead, color: c.accent },
  progressTrack: {
    height: 6,
    backgroundColor: c.surface2,
    marginHorizontal: spacing.gutter,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.accent,
    borderRadius: borderRadius.pill,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  chapterDot: { width: 6, height: 6, borderRadius: 3 },
  chapterDotActive: { width: 16, borderRadius: 3 },
  chapterDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    marginTop: spacing.lg,
  },
  chapterDoneText: { ...type.footnote },
  scrollContent: { padding: spacing.gutter, paddingBottom: spacing['3xl'] },
  title: {
    ...type.title1,
    fontFamily: 'PlayfairDisplay-Bold',
    color: c.fgStrong,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: { ...type.body, color: c.textMuted, marginBottom: spacing['2xl'] },
  content: { gap: spacing.lg },
  footer: {
    padding: spacing.gutter,
    borderTopWidth: 0.5,
    borderTopColor: c.hairline,
  },
});
