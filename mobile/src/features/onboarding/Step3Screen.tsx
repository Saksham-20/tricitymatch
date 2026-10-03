import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import { tapSize } from '../../utils/elderTheme';
import OnboardingLayout, { flushField, useOnboardingControls } from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import type { ManglikStatus } from '../../types';

const MANGLIK_OPTIONS: { key: ManglikStatus; tKey: string }[] = [
  { key: 'manglik', tKey: 'onboarding.step3.manglikOptions.manglik' },
  { key: 'non_manglik', tKey: 'onboarding.step3.manglikOptions.non_manglik' },
  { key: 'anshik_manglik', tKey: 'onboarding.step3.manglikOptions.anshik_manglik' },
  { key: 'not_sure', tKey: 'onboarding.step3.manglikOptions.not_sure' },
];

export default function Step3Screen() {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();
  const controls = useOnboardingControls();

  const [manglikStatus, setManglikStatus] = useState<ManglikStatus | null>(data.manglikStatus);
  const [birthTime, setBirthTime] = useState(data.birthTime);
  const [placeOfBirth, setPlaceOfBirth] = useState(data.placeOfBirth);

  const isValid = !!manglikStatus;

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  // Same string for the eye and the screen reader, so "(Optional)" is spoken.
  const birthTimeLabel = `${t('onboarding.step3.birthTime')} (${t('common.optional')})`;
  const birthPlaceLabel = `${t('onboarding.step3.birthPlace')} (${t('common.optional')})`;

  const handleContinue = async () => {
    const answers = { manglikStatus, birthTime: birthTime.trim(), placeOfBirth: placeOfBirth.trim() };
    await saveAndNext(answers, answers);
  };

  return (
    <OnboardingLayout
      step={3}
      title={t('onboarding.step3.title')}
      subtitle={t('onboarding.step3.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
      skippable
      onSkip={handleSkip}
    >
      <View style={styles.skipNote}>
        <Text variant="subhead" color="textPrimary" style={styles.skipNoteTitle}>{t('onboarding.step3.skipTitle')}</Text>
        <Text variant="footnote" color="textSecondary">{t('onboarding.step3.skipBody')}</Text>
      </View>
      {/* Manglik status */}
      <View>
        <Text variant="footnote" color="textPrimary" style={styles.label}>{t('onboarding.step3.manglikStatus')}</Text>
        <View
          style={styles.grid}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('onboarding.step3.manglikStatus')}
        >
          {MANGLIK_OPTIONS.map((opt) => {
            const isActive = manglikStatus === opt.key;
            return (
              <PressableScale
                key={opt.key}
                scaleTo={0.95}
                style={[styles.optionBtn, { minHeight: tapSize(elder) }, isActive && styles.optionBtnActive]}
                onPress={() => { haptics.light(); setManglikStatus(opt.key); }}
                testID={`manglik-${opt.key}`}
                accessibilityLabel={t(opt.tKey)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive, checked: isActive }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {/* Selection is a checkmark as well as a tint, so colour is never the only cue. */}
                {isActive ? (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={c.accent}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                ) : null}
                <Text variant="subhead" color={isActive ? 'primary' : 'textPrimary'}>
                  {t(opt.tKey)}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Birth details reveal only after manglik is answered — kundli
          questions stay hidden until the member engages with the topic */}
      {manglikStatus ? (
        <>
          <Text variant="headline" color="textSecondary" style={styles.sectionHeader} accessibilityRole="header">
            {t('onboarding.step3.birthDetails')}
          </Text>
          {/* Server caps birthTime at 20 and placeOfBirth at 100 characters; a longer value 400s the whole save. */}
          <Input
            {...controls.inputProps}
            label={birthTimeLabel}
            value={birthTime}
            onChangeText={setBirthTime}
            containerStyle={flushField}
            placeholder={t('onboarding.placeholders.birthTime', 'HH:MM (e.g. 06:30)')}
            keyboardType="numbers-and-punctuation"
            maxLength={20}
            testID="input-birthTime"
            accessibilityLabel={birthTimeLabel}
          />
          <Input
            {...controls.inputProps}
            label={birthPlaceLabel}
            value={placeOfBirth}
            onChangeText={setPlaceOfBirth}
            containerStyle={flushField}
            placeholder={t('onboarding.placeholders.birthPlace', 'City of birth')}
            autoCapitalize="words"
            // No address/city autofill hint: it would offer the member's CURRENT city as their birthplace.
            autoComplete="off"
            returnKeyType="done"
            maxLength={100}
            testID="input-placeOfBirth"
            accessibilityLabel={birthPlaceLabel}
          />
        </>
      ) : null}
    </OnboardingLayout>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  // Same treatment as Input's label, so chips and text fields on one screen read as one form.
  label: {
    fontFamily: 'Inter-SemiBold',
    marginBottom: 6,
  },
  sectionHeader: {
    marginTop: spacing.sm,
  },
  skipNote: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface2,
    gap: 4,
  },
  skipNoteTitle: { fontFamily: 'Inter-SemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionBtn: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
});
