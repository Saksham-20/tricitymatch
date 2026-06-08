import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import type { MaritalStatus } from '../../types';

const MARITAL_OPTIONS: { key: MaritalStatus; tKey: string }[] = [
  { key: 'never_married', tKey: 'onboarding.step7.statusOptions.never_married' },
  { key: 'divorced', tKey: 'onboarding.step7.statusOptions.divorced' },
  { key: 'widowed', tKey: 'onboarding.step7.statusOptions.widowed' },
  { key: 'awaiting_divorce', tKey: 'onboarding.step7.statusOptions.awaiting_divorce' },
];

export default function Step7Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(data.maritalStatus);
  const [hasChildren, setHasChildren] = useState(data.hasChildren);
  const [childrenCount, setChildrenCount] = useState(
    data.numberOfChildren !== null ? String(data.numberOfChildren) : '',
  );

  const isValid = !!maritalStatus;

  const handleContinue = async () => {
    const numChildren = hasChildren && childrenCount ? Number(childrenCount) : 0;
    await saveAndNext(
      { maritalStatus, hasChildren, numberOfChildren: hasChildren ? numChildren : null },
      { maritalStatus, numberOfChildren: numChildren } as any,
    );
  };

  return (
    <OnboardingLayout
      step={7}
      title={t('onboarding.step7.title')}
      subtitle={t('onboarding.step7.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Marital status */}
      <View>
        <Text style={styles.label}>{t('onboarding.step7.status')}</Text>
        <View style={styles.optionsContainer}>
          {MARITAL_OPTIONS.map((opt) => {
            const isActive = maritalStatus === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                onPress={() => setMaritalStatus(opt.key)}
                testID={`marital-${opt.key}`}
                accessibilityLabel={t(opt.tKey)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionBtnText, isActive && styles.optionBtnTextActive]}>
                  {t(opt.tKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Children */}
      <View>
        <Text style={styles.label}>{t('onboarding.step7.children')}</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.yesNoBtn, !hasChildren && styles.yesNoBtnActive]}
            onPress={() => setHasChildren(false)}
            testID="children-no"
            accessibilityLabel={t('common.no')}
            accessibilityRole="radio"
            accessibilityState={{ selected: !hasChildren }}
          >
            <Text style={[styles.yesNoBtnText, !hasChildren && styles.yesNoBtnTextActive]}>
              {t('common.no')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.yesNoBtn, hasChildren && styles.yesNoBtnActive]}
            onPress={() => setHasChildren(true)}
            testID="children-yes"
            accessibilityLabel={t('common.yes')}
            accessibilityRole="radio"
            accessibilityState={{ selected: hasChildren }}
          >
            <Text style={[styles.yesNoBtnText, hasChildren && styles.yesNoBtnTextActive]}>
              {t('common.yes')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Number of children */}
      {hasChildren && (
        <View>
          <Text style={styles.label}>{t('onboarding.step7.childrenCount')}</Text>
          <TextInput
            style={styles.input}
            value={childrenCount}
            onChangeText={setChildrenCount}
            placeholder="0"
            placeholderTextColor={colours.textMuted}
            keyboardType="number-pad"
            maxLength={1}
            testID="input-childrenCount"
            accessibilityLabel={t('onboarding.step7.childrenCount')}
          />
        </View>
      )}
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
  optionsContainer: { gap: spacing.sm },
  optionBtn: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  optionBtnActive: { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  optionBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  optionBtnTextActive: { color: colours.primary },
  row: { flexDirection: 'row', gap: spacing.sm },
  yesNoBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesNoBtnActive: { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  yesNoBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  yesNoBtnTextActive: { color: colours.primary },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    minHeight: 48,
    width: 100,
  },
});
