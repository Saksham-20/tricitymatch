import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colours, type, spacing, borderRadius } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding, type RegisteringFor } from './OnboardingContext';

const OPTIONS: { key: RegisteringFor; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'self', icon: 'person-outline' },
  { key: 'son', icon: 'man-outline' },
  { key: 'daughter', icon: 'woman-outline' },
  { key: 'sibling', icon: 'people-outline' },
  { key: 'relative', icon: 'people-circle-outline' },
  { key: 'friend', icon: 'happy-outline' },
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
            <PressableScale
              key={opt.key}
              scaleTo={0.96}
              style={[styles.tile, isActive && styles.tileActive]}
              onPress={() => { haptics.light(); setSelected(opt.key); }}
              testID={`tile-${opt.key}`}
              accessibilityLabel={t(`onboarding.step0.options.${opt.key}`)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
            >
              {isActive && (
                <View style={styles.check}>
                  <Ionicons name="checkmark-circle" size={20} color={colours.primary} />
                </View>
              )}
              <Ionicons name={opt.icon} size={30} color={isActive ? colours.primary : colours.textSecondary} />
              <Text style={[styles.tileLabel, isActive && styles.tileLabelActive]}>
                {t(`onboarding.step0.options.${opt.key}`)}
              </Text>
            </PressableScale>
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
    minHeight: 104,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
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
  check: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  tileLabel: {
    ...type.headline,
    color: colours.textPrimary,
    textAlign: 'center',
  },
  tileLabelActive: {
    color: colours.primary,
  },
});
