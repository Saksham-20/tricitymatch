import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import type { Diet, SmokingDrinking } from '../../types';

type Exercise = 'daily' | 'weekly' | 'rarely' | 'never';

interface RadioGroupProps<T extends string> {
  label: string;
  options: { key: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
  testPrefix: string;
}

function RadioGroup<T extends string>({
  label, options, selected, onSelect, testPrefix,
}: RadioGroupProps<T>) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onSelect(opt.key)}
              testID={`${testPrefix}-${opt.key}`}
              accessibilityLabel={opt.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const handleContinue = async () => {
    await saveAndNext(
      { diet, drinking, smoking, exercise },
      { diet, smoking, drinking } as any,
    );
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
      <RadioGroup
        label={t('onboarding.step8.diet')}
        options={DIET_OPTIONS}
        selected={diet}
        onSelect={setDiet}
        testPrefix="diet"
      />
      <RadioGroup
        label={t('onboarding.step8.drinking')}
        options={DRINKING_OPTIONS}
        selected={drinking}
        onSelect={setDrinking}
        testPrefix="drinking"
      />
      <RadioGroup
        label={t('onboarding.step8.smoking')}
        options={SMOKING_OPTIONS}
        selected={smoking}
        onSelect={setSmoking}
        testPrefix="smoking"
      />
      <RadioGroup
        label={t('onboarding.step8.exercise')}
        options={EXERCISE_OPTIONS}
        selected={exercise}
        onSelect={setExercise}
        testPrefix="exercise"
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
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
    borderColor: colours.border,
    borderRadius: borderRadius.full,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {
    borderColor: colours.primary,
    backgroundColor: colours.primaryLight,
  },
  pillText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  pillTextActive: {
    color: colours.primary,
  },
});
