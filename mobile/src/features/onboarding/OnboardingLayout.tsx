import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  LayoutChangeEvent,
} from 'react-native';
import Text from '../../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { Button } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { PressableScale, useReduceMotion } from '../../components/motion';
import { tapSize } from '../../utils/elderTheme';
import {
  useOnboarding,
  chapterForStep,
  JOURNEY_CHAPTERS,
  JOURNEY_ENDOWED_PROGRESS,
  JOURNEY_STEPS,
  type JourneyStepName,
} from './OnboardingContext';

interface OnboardingLayoutProps {
  /**
   * The screen's own step number (Step2 passes 2). It is this screen's identity:
   * the header, chapter and progress derive from it, and the journey provider is
   * re-aligned to it whenever the screen gains focus (so Android's system back,
   * which never calls goBack, cannot leave the provider a step ahead).
   */
  step: number;
  title: string;
  subtitle?: string;
  onContinue: () => void;
  continueDisabled?: boolean;
  skippable?: boolean;
  onSkip?: () => void;
  children: React.ReactNode;
}

/** Bar position for a journey step index; index -1 is the endowed head start alone. */
const progressAt = (index: number, count: number) =>
  JOURNEY_ENDOWED_PROGRESS + (1 - JOURNEY_ENDOWED_PROGRESS) * Math.max(0, Math.min(1, (index + 1) / count));

/**
 * Input carries its own 15pt bottom margin; inside the layout's `gap` that
 * doubles up (an Input was followed by ~31pt, a select field by 16pt). Pass as
 * an Input's `containerStyle` so text fields and pickers share one rhythm.
 */
export const flushField = StyleSheet.create({ flush: { marginBottom: 0 } }).flush;

/**
 * What a journey step needs from the shared `Input` and `Button` that they do
 * not yet do themselves. Neither has any elder handling (their own floors are
 * 50pt and 54/44pt), and `Input` paints its placeholder in n400, which is 2.5:1
 * on the field surface. Steps spread/pass these instead of hard-coding heights.
 */
export function useOnboardingControls() {
  const { c, elder } = useTheme();
  return React.useMemo(() => ({
    /** Spread onto an `Input`: 50pt (its own floor), 60pt in elder mode, placeholder that clears 4.5:1. */
    inputProps: {
      style: { minHeight: Math.max(50, tapSize(elder)) },
      placeholderTextColor: c.textSecondary,
    },
    /** `style` for a primary `Button`. Only elder needs it: the button's own 54pt already clears 48. */
    buttonStyle: elder ? { minHeight: tapSize(elder), justifyContent: 'center' as const } : undefined,
    /** `style` for a `variant="text"` Button, whose own 44pt sits under the 48pt default target. */
    textButtonStyle: { minHeight: tapSize(elder) },
  }), [c, elder]);
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
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { goBack, exit, isSaving, saveFailed, registerInlineSaveError, syncStep, currentStep, stepCount } = useOnboarding();
  const reduced = useReduceMotion();
  const target = tapSize(elder);
  const controls = useOnboardingControls();

  // This screen's own place in the journey. Everything below (back vs close,
  // chapter, bar) derives from it rather than from the provider's counter, so
  // the chrome always describes the screen that is showing. Falls back to the
  // provider only for a `step` that is not a journey step.
  const ownIndex = JOURNEY_STEPS.indexOf(`Step${step}` as JourneyStepName);
  const stepIndex = ownIndex >= 0 ? ownIndex : currentStep;

  // The provider decides where Continue goes (`current + 1`), and it only hears
  // about moves it made itself. Android's system back pops this stack without
  // telling it, which used to leave Continue one step ahead of the screen and
  // skip a required step. Reporting on focus keeps them aligned on every path.
  useFocusEffect(
    React.useCallback(() => {
      if (ownIndex >= 0) syncStep(ownIndex);
    }, [ownIndex, syncStep]),
  );

  // This screen renders a failed save inline (below), so the provider must not
  // also toast the same failure at the member. Only while FOCUSED: the native
  // stack keeps every earlier step mounted underneath, and a step with its own
  // chrome (Step12) still needs the toast.
  const focused = useIsFocused();
  React.useEffect(() => (focused ? registerInlineSaveError() : undefined), [focused, registerInlineSaveError]);

  const saveFailedTitle = t('onboarding.saveFailedTitle', "Couldn't save your answers");
  // The action name comes from the button's own label, so the body cannot drift from it.
  const saveFailedBody = t('onboarding.saveFailedBody', {
    defaultValue: 'Check your connection, then tap {{action}} to try again.',
    action: t('onboarding.saveAndContinue'),
  });
  React.useEffect(() => {
    // iOS VoiceOver only hears an explicit announce. Android reads the banner's
    // live region, so announcing there too made TalkBack say it twice.
    if (saveFailed && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(`${saveFailedTitle}. ${saveFailedBody}`);
    }
  }, [saveFailed, saveFailedTitle, saveFailedBody]);

  // Chapters, not step numbers: the header names where you are, the bar shows
  // how far. Endowed-progress credit — signup already covered the basics, so
  // the journey never starts from an empty bar (Nunes & Drèze).
  const chapter = chapterForStep(stepIndex);
  const chapterName = t(`journey.chapters.${chapter.i18nKey}`, chapter.fallback);
  const progress = progressAt(stepIndex, stepCount);

  // Progress fill: a full-width, absolutely positioned, childless layer that
  // slides in from the left by translateX — a transform, so the animation never
  // re-runs layout (doctrine §10.4). The track clips it. Both values are shared
  // values, so no JS state changes (and no re-render) while it glides.
  // Every step is its own screen instance, so the fill is seeded at the PREVIOUS
  // step's position: the bar arrives where the last screen left it and only the
  // one-step delta glides, instead of re-filling from empty each time (which hid
  // the endowed head start). Reduce-motion: the fill snaps to the new value.
  const trackW = useSharedValue(0);
  const fill = useSharedValue(progressAt(stepIndex - 1, stepCount));
  const fillStyle = useAnimatedStyle(() => ({
    // Hidden until the track has been measured, so it never flashes full-width.
    opacity: trackW.value > 0 ? 1 : 0,
    transform: [{ translateX: (fill.value - 1) * trackW.value }],
  }));
  const onTrackLayout = (e: LayoutChangeEvent) => { trackW.value = e.nativeEvent.layout.width; };
  React.useEffect(() => {
    fill.value = reduced
      ? progress
      : withTiming(progress, { duration: duration.layout, easing: Easing.bezier(...EASE_OUT) });
  }, [progress, reduced, fill]);

  // Warm one-liner at the top of each new chapter (skip the very first).
  const chapterDoneLine =
    chapter.isChapterStart && chapter.chapterIndex > 0
      ? t(`journey.chapterDoneLine.${JOURNEY_CHAPTERS[chapter.chapterIndex - 1].i18nKey}`, '')
      : stepIndex === 0
        ? t('journey.endowedLine', "You're already a quarter done. Signup covered the basics.")
        : '';

  return (
    <SafeAreaView style={styles.safe} testID={`OnboardingStep${step}`}>
      {/* Header: chrome targets are real 48pt (60pt in elder mode), not 40pt marks padded by hitSlop. */}
      <View style={styles.header}>
        {stepIndex > 0 ? (
          <PressableScale
            scaleTo={0.92}
            onPress={goBack}
            style={[styles.chromeBtn, { width: target, height: target }]}
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
            style={[styles.chromeBtn, { width: target, height: target }]}
            testID="btn-close-tap44-hitslop"
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={c.fgStrong} />
          </PressableScale>
        )}
        {/* Single-line chrome row: capped so 200% text cannot wrap it or push Skip off-screen. */}
        <Text variant="subhead" color="textSecondary" numberOfLines={1} maxScale={1.3} style={styles.chapterLabel}>
          {chapterName}
        </Text>
        {skippable ? (
          <PressableScale
            onPress={onSkip}
            style={[styles.skipBtn, { minHeight: target }]}
            testID="btn-skip-tap44-hitslop"
            accessibilityRole="button"
            accessibilityLabel={t('common.skip')}
            hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color="primary" numberOfLines={1} maxScale={1.3}>{t('common.skip')}</Text>
          </PressableScale>
        ) : (
          <View style={{ width: target }} />
        )}
      </View>

      {/* Progress bar + chapter dots (no numerals — chapters orient instead) */}
      <View
        style={styles.progressTrack}
        onLayout={onTrackLayout}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('journey.progressLabel', 'Setup progress')}
        // The endowed head start is a design credit, not a measurement, so a
        // screen reader gets the chapter it is in, never an invented percentage.
        accessibilityValue={{ text: chapterName }}
      >
        <Animated.View style={[styles.progressFill, fillStyle]} />
      </View>
      <View style={styles.dotRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {JOURNEY_CHAPTERS.map((ch, i) => (
          <View
            key={ch.i18nKey}
            style={[
              styles.chapterDot,
              { backgroundColor: i <= chapter.chapterIndex ? c.accent : c.surface2 },
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
            <View style={styles.chapterDone}>
              <Ionicons name="checkmark-circle" size={15} color={c.accent} accessibilityElementsHidden importantForAccessibility="no" />
              <Text variant="footnote" color="primary" style={styles.chapterDoneText}>{chapterDoneLine}</Text>
            </View>
          ) : null}
          <Text variant="title1" color="fgStrong" style={styles.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text variant="body" color="textSecondary" style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.content}>{children}</View>
        </ScrollView>

        {/* Footer: a failed save stays visible next to the button that retries it. */}
        <View style={styles.footer}>
          {saveFailed ? (
            <View style={styles.saveError} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="save-error">
              <Ionicons name="alert-circle-outline" size={20} color={c.error} accessibilityElementsHidden importantForAccessibility="no" />
              <View style={styles.saveErrorText}>
                <Text variant="subhead" color="error">{saveFailedTitle}</Text>
                <Text variant="footnote" color="textSecondary">{saveFailedBody}</Text>
              </View>
            </View>
          ) : null}
          <Button
            title={t('onboarding.saveAndContinue')}
            onPress={onContinue}
            loading={isSaving}
            disabled={continueDisabled}
            size="lg"
            style={controls.buttonStyle}
            testID="btn-continue"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Select field: label above, a full-width row that opens a PickerSheet. Four
// journey steps hand-rolled this (label + bordered pressable) and none of them
// told a screen reader the current value, that it opens a list, or that it was
// a picker at all. One implementation, exported for the steps to adopt.
// ---------------------------------------------------------------------------
interface OnboardingSelectFieldProps {
  label: string;
  /** Marks the field "(Optional)" in the label, matching the Input fields beside it. */
  optional?: boolean;
  /** Display text of the current selection; '' when nothing is chosen. */
  value: string;
  placeholder: string;
  onPress: () => void;
  /** The picker sheet for this field is currently open. */
  open?: boolean;
  testID: string;
}

export function OnboardingSelectField({
  label,
  optional = false,
  value,
  placeholder,
  onPress,
  open = false,
  testID,
}: OnboardingSelectFieldProps) {
  const { t } = useTranslation();
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeSelectStyles(c), [c]);
  // One string for the eye and for the screen reader / Voice Control: the
  // "(Optional)" marker is how a member tells required from optional.
  const fullLabel = optional ? `${label} (${t('common.optional')})` : label;
  return (
    <View>
      <Text variant="footnote" color="textPrimary" style={styles.label}>
        {fullLabel}
      </Text>
      <PressableScale
        style={[styles.selectBtn, { minHeight: Math.max(48, tapSize(elder)) }]}
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={fullLabel}
        accessibilityValue={{ text: value || placeholder }}
        accessibilityHint={t('onboarding.selectHint', 'Opens a list of options')}
        accessibilityState={{ expanded: open }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {/* textSecondary, not textMuted: #8B8B8B on the field surface is 3.4:1, short of the 4.5:1 a placeholder needs. */}
        <Text variant="callout" color={value ? 'textPrimary' : 'textSecondary'} style={styles.selectText}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={c.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
      </PressableScale>
    </View>
  );
}

const makeSelectStyles = (c: ThemeColours) => StyleSheet.create({
  // Same treatment as Input's label, so a picker and a text field on one screen read as one form.
  label: { fontFamily: 'Inter-SemiBold', marginBottom: 6 },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    backgroundColor: c.surfaceCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectText: { flex: 1 },
});

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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chromeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterLabel: { flex: 1, textAlign: 'center' },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  progressTrack: {
    height: 6,
    backgroundColor: c.surface2,
    marginHorizontal: spacing.gutter,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    // Full-size, absolutely positioned and childless: the only shape doctrine
    // §10.4 sanctions for an animated progress fill. It is moved with a
    // transform (translateX), so no layout runs per frame.
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: c.accentSoft,
  },
  chapterDoneText: { flexShrink: 1 },
  scrollContent: { padding: spacing.gutter, paddingBottom: spacing['3xl'] },
  title: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: { marginBottom: spacing['2xl'] },
  content: { gap: spacing.lg },
  footer: {
    padding: spacing.gutter,
    gap: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: c.hairline,
    backgroundColor: c.background,
  },
  saveError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: c.errorBg,
  },
  saveErrorText: { flex: 1, gap: 2 },
});
