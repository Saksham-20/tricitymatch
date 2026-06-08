import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding, type RegisteringFor } from './OnboardingContext';

const OPTIONS: { key: RegisteringFor; icon: string }[] = [
  { key: 'self', icon: '🙋' },
  { key: 'son', icon: '👦' },
  { key: 'daughter', icon: '👧' },
  { key: 'sibling', icon: '🧑‍🤝‍🧑' },
  { key: 'relative', icon: '👨‍👩‍👧' },
  { key: 'friend', icon: '🤝' },
];

export default function Step0Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();
  const [selected, setSelected] = useState<RegisteringFor | null>(data.registeringFor);

  const handleContinue = async () => {
    if (!selected) return;
    await saveAndNext({ registeringFor: selected }, {});
  };

  return (
    <OnboardingLayout
      step={0}
      title={t('onboarding.step0.title')}
      subtitle={t('onboarding.step0.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!selected}
    >
      <View style={styles.grid}>
        {OPTIONS.map((opt) => {
          const isActive = selected === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.tile, isActive && styles.tileActive]}
              onPress={() => setSelected(opt.key)}
              testID={`tile-${opt.key}`}
              accessibilityLabel={t(`onboarding.step0.options.${opt.key}`)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={styles.tileIcon}>{opt.icon}</Text>
              <Text style={[styles.tileLabel, isActive && styles.tileLabelActive]}>
                {t(`onboarding.step0.options.${opt.key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: '47%',
    minHeight: 80,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colours.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tileActive: {
    borderColor: colours.primary,
    backgroundColor: colours.primaryLight,
  },
  tileIcon: {
    fontSize: 28,
  },
  tileLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    textAlign: 'center',
  },
  tileLabelActive: {
    color: colours.primary,
  },
});
