import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { AccessibilityInfo, Platform, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import { tapSize } from '../../utils/elderTheme';
import Text from '../../components/ui/Text';
import { Button } from '../../components/ui';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding, type JourneyProfilePatch } from './OnboardingContext';
import { queryKeys } from '../../constants/queryKeys';
import { getMyProfile } from '../../api/profile';
import type { Diet, SmokingDrinking } from '../../types';

type Exercise = 'daily' | 'weekly' | 'rarely' | 'never';

// A drifting finger must not cancel a press (doctrine §10.8).
const RETAIN = { top: 10, bottom: 10, left: 10, right: 10 } as const;

interface RadioGroupProps<T extends string> {
  label: string;
  options: { key: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
  testPrefix: string;
  /** i18n key prefix: each option's label is `${labelPrefix}.${key}`, the option's own label is the English fallback. */
  labelPrefix: string;
}

function RadioGroup<T extends string>({
  label, options, selected, onSelect, testPrefix, labelPrefix,
}: RadioGroupProps<T>) {
  const { c, elder } = useTheme();
  const { t } = useTranslation();
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c, tap), [c, tap]);
  return (
    <View>
      <Text variant="subhead" color="textPrimary" style={styles.label}>{label}</Text>
      <View style={styles.pillRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((opt) => {
          const active = selected === opt.key;
          const optLabel = t(`${labelPrefix}.${opt.key}`, opt.label);
          return (
            <PressableScale
              key={opt.key}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => {
                if (active) return; // re-tapping the current choice is not a commit
                haptics.light();
                onSelect(opt.key);
              }}
              testID={`${testPrefix}-${opt.key}`}
              accessibilityLabel={optLabel}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, selected: active }}
              pressRetentionOffset={RETAIN}
            >
              <Text variant="subhead" color={active ? 'primary' : 'textPrimary'}>
                {optLabel}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Shown when the saved profile could not be loaded, so the pills below are not
 * misread as "nothing saved yet". Nothing here is overwritten (only chosen
 * groups are sent), which is why the form stays usable behind it.
 */
function SavedLoadNotice({ onRetry }: { onRetry: () => void }) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => makeNoticeStyles(c), [c]);
  const message = t('onboarding.loadFailedTitle', "Couldn't load your saved answers");
  useEffect(() => {
    // Android reads the live region; iOS VoiceOver only hears an explicit announce.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite" testID="saved-error">
      <Ionicons
        name="alert-circle-outline"
        size={20}
        color={c.error}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text variant="footnote" color="textSecondary" style={styles.noticeText}>{message}</Text>
      <Button title={t('common.retry')} variant="text" size="sm" onPress={onRetry} testID="btn-retry-saved" />
    </View>
  );
}

const DIET_OPTIONS: { key: Diet; label: string }[] = [
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'non-vegetarian', label: 'Non-Veg' },
  { key: 'jain', label: 'Jain' },
  { key: 'vegan', label: 'Vegan' },
];

const DRINKING_OPTIONS: { key: SmokingDrinking; label: string }[] = [
  { key: 'never', label: 'Never' },
  { key: 'occasionally', label: 'Socially' },
  { key: 'regularly', label: 'Regularly' },
];

const SMOKING_OPTIONS: { key: SmokingDrinking; label: string }[] = [
  { key: 'never', label: 'Never' },
  { key: 'occasionally', label: 'Occasionally' },
  { key: 'regularly', label: 'Regularly' },
];

const EXERCISE_OPTIONS: { key: Exercise; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'rarely', label: 'Rarely' },
  { key: 'never', label: 'Never' },
];

export default function Step8Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [diet, setDiet] = useState<Diet | null>(data.diet);
  const [drinking, setDrinking] = useState<SmokingDrinking | null>(data.drinking);
  const [smoking, setSmoking] = useState<SmokingDrinking | null>(data.smoking);
  const [exercise, setExercise] = useState<Exercise | null>(data.exercise);

  // The journey context does not hydrate these from the saved profile, so a member
  // who already answered elsewhere would see every pill unselected. Fill only the
  // groups still unchosen, so a late response never undoes a tap.
  const {
    data: saved,
    isError: savedError,
    isFetching: savedFetching,
    refetch: refetchSaved,
  } = useQuery({ queryKey: queryKeys.myProfile, queryFn: getMyProfile });
  useEffect(() => {
    if (!saved) return;
    setDiet((prev) => prev ?? saved.diet ?? null);
    setDrinking((prev) => prev ?? saved.drinking ?? null);
    setSmoking((prev) => prev ?? saved.smoking ?? null);
  }, [saved]);
  const savedFailed = !saved && savedError && !savedFetching;

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const handleContinue = async () => {
    // Only send what was chosen: an untouched group means "no answer", not "clear it".
    const profilePatch: JourneyProfilePatch = {};
    if (diet) profilePatch.diet = diet;
    if (smoking) profilePatch.smoking = smoking;
    if (drinking) profilePatch.drinking = drinking;
    await saveAndNext({ diet, drinking, smoking, exercise }, profilePatch);
  };

  return (
    <OnboardingLayout
      step={8}
      title={t('onboarding.step8.title')}
      subtitle={t('onboarding.step8.subtitle')}
      onContinue={handleContinue}
      skippable
      onSkip={handleSkip}
    >
      {savedFailed ? <SavedLoadNotice onRetry={() => { refetchSaved(); }} /> : null}
      <RadioGroup
        label={t('onboarding.step8.diet')}
        options={DIET_OPTIONS}
        selected={diet}
        onSelect={setDiet}
        testPrefix="diet"
        labelPrefix="onboarding.step8.dietOptions"
      />
      <RadioGroup
        label={t('onboarding.step8.drinking')}
        options={DRINKING_OPTIONS}
        selected={drinking}
        onSelect={setDrinking}
        testPrefix="drinking"
        labelPrefix="onboarding.step8.drinkingOptions"
      />
      <RadioGroup
        label={t('onboarding.step8.smoking')}
        options={SMOKING_OPTIONS}
        selected={smoking}
        onSelect={setSmoking}
        testPrefix="smoking"
        labelPrefix="onboarding.step8.smokingOptions"
      />
      <RadioGroup
        label={t('onboarding.step8.exercise')}
        options={EXERCISE_OPTIONS}
        selected={exercise}
        onSelect={setExercise}
        testPrefix="exercise"
        labelPrefix="onboarding.step8.exerciseOptions"
      />
    </OnboardingLayout>
  );
}

const makeStyles = (c: ThemeColours, tap: number) => StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.full,
    minHeight: tap,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {
    borderColor: c.primary,
    backgroundColor: c.primaryLight,
  },
});

const makeNoticeStyles = (c: ThemeColours) => StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: c.errorBg,
  },
  noticeText: { flex: 1, paddingVertical: spacing.sm },
});
