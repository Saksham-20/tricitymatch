import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Text from '../../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { Button } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { PressableScale, useReduceMotion } from '../../components/motion';
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
      : withTiming(target, { duration: duration.layout, easing: Easing.bezier(...EASE_OUT) });
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
          <PressableScale
            scaleTo={0.92}
            onPress={goBack}
            style={styles.backBtn}
            testID="btn-back-tap44-hitslop"
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={c.fgStrong} />
          </PressableScale>
        ) : (
          // First journey screen: journey is skippable — close returns to Main.
          <PressableScale
            scaleTo={0.92}
            onPress={exit}
            style={styles.backBtn}
            testID="btn-close-tap44-hitslop"
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={c.fgStrong} />
          </PressableScale>
        )}
        <Text variant="subhead" color="textMuted">
          {t(`journey.chapters.${chapter.i18nKey}`, chapter.fallback)}
        </Text>
        {skippable ? (
          <PressableScale
            onPress={onSkip}
            testID="btn-skip-tap44-hitslop"
            accessibilityRole="button"
            accessibilityLabel={t('common.skip')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color="primary">{t('common.skip')}</Text>
          </PressableScale>
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
              <Text variant="footnote" color="primary">{chapterDoneLine}</Text>
            </View>
          ) : null}
          <Text variant="title1" color="fgStrong" style={styles.title}>{title}</Text>
          {subtitle ? <Text variant="body" color="textMuted" style={styles.subtitle}>{subtitle}</Text> : null}
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
  headerRight: { width: 40 },
  progressTrack: {
    height: 6,
    backgroundColor: c.surface2,
    marginHorizontal: spacing.gutter,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    // Absolutely positioned + childless (doctrine §10.4's exception to
    // "never animate a layout property on an in-flow node") — animating its
    // width no longer re-runs Yoga for progressTrack + siblings every frame.
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
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
  scrollContent: { padding: spacing.gutter, paddingBottom: spacing['3xl'] },
  title: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: { marginBottom: spacing['2xl'] },
  content: { gap: spacing.lg },
  footer: {
    padding: spacing.gutter,
    borderTopWidth: 0.5,
    borderTopColor: c.hairline,
  },
});
