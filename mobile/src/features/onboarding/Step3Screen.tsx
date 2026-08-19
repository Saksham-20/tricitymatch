import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import type { ManglikStatus } from '../../types';

const MANGLIK_OPTIONS: { key: ManglikStatus; tKey: string }[] = [
  { key: 'manglik', tKey: 'onboarding.step3.manglikOptions.manglik' },
  { key: 'non_manglik', tKey: 'onboarding.step3.manglikOptions.non_manglik' },
  { key: 'anshik_manglik', tKey: 'onboarding.step3.manglikOptions.anshik_manglik' },
  { key: 'not_sure', tKey: 'onboarding.step3.manglikOptions.not_sure' },
];

export default function Step3Screen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [manglikStatus, setManglikStatus] = useState<ManglikStatus | null>(data.manglikStatus);
  const [birthTime, setBirthTime] = useState(data.birthTime);
  const [placeOfBirth, setPlaceOfBirth] = useState(data.placeOfBirth);

  const isValid = !!manglikStatus;

  const handleContinue = async () => {
    await saveAndNext(
      { manglikStatus, birthTime, placeOfBirth },
      { manglikStatus, birthTime, placeOfBirth } as any,
    );
  };

  return (
    <OnboardingLayout
      step={3}
      title={t('onboarding.step3.title')}
      subtitle={t('onboarding.step3.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Manglik status */}
      <View>
        <Text style={styles.label}>{t('onboarding.step3.manglikStatus')}</Text>
        <View style={styles.grid}>
          {MANGLIK_OPTIONS.map((opt) => {
            const isActive = manglikStatus === opt.key;
            return (
              <PressableScale
                key={opt.key}
                scaleTo={0.95}
                style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                onPress={() => { haptics.light(); setManglikStatus(opt.key); }}
                testID={`manglik-${opt.key}`}
                accessibilityLabel={t(opt.tKey)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionBtnText, isActive && styles.optionBtnTextActive]}>
                  {t(opt.tKey)}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Birth details */}
      <View>
        <Text style={styles.sectionHeader}>{t('onboarding.step3.birthDetails')}</Text>
      </View>

      <View>
        <Text style={styles.label}>
          {t('onboarding.step3.birthTime')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={birthTime}
          onChangeText={setBirthTime}
          placeholder="HH:MM (e.g. 06:30)"
          placeholderTextColor={c.textMuted}
          keyboardType="numbers-and-punctuation"
          testID="input-birthTime"
          accessibilityLabel={t('onboarding.step3.birthTime')}
        />
      </View>

      <View>
        <Text style={styles.label}>
          {t('onboarding.step3.birthPlace')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={placeOfBirth}
          onChangeText={setPlaceOfBirth}
          placeholder="City of birth"
          placeholderTextColor={c.textMuted}
          autoCapitalize="words"
          autoComplete="postal-address-locality"
          textContentType="addressCity"
          returnKeyType="done"
          testID="input-placeOfBirth"
          accessibilityLabel={t('onboarding.step3.birthPlace')}
        />
      </View>
    </OnboardingLayout>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  optional: { color: c.textMuted, fontFamily: typography.fontFamily.regular },
  sectionHeader: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: c.textSecondary,
    marginTop: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionBtn: {
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
  optionBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: c.textPrimary,
  },
  optionBtnTextActive: { color: c.primary },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: c.textPrimary,
    minHeight: 48,
  },
});
