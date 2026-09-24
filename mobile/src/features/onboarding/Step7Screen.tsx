import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { AccessibilityInfo, View, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import { tapSize } from '../../utils/elderTheme';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import OnboardingLayout, { flushField } from './OnboardingLayout';
import { useOnboarding, type JourneyProfilePatch } from './OnboardingContext';
import type { MaritalStatus } from '../../types';

// A drifting finger must not cancel a press (doctrine §10.8).
const RETAIN = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const MARITAL_OPTIONS: { key: MaritalStatus; tKey: string }[] = [
  { key: 'never_married', tKey: 'onboarding.step7.statusOptions.never_married' },
  { key: 'divorced', tKey: 'onboarding.step7.statusOptions.divorced' },
  { key: 'widowed', tKey: 'onboarding.step7.statusOptions.widowed' },
  { key: 'awaiting_divorce', tKey: 'onboarding.step7.statusOptions.awaiting_divorce' },
];

export default function Step7Screen() {
  const { c, elder } = useTheme();
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c, tap), [c, tap]);
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(data.maritalStatus);
  // The profile only stores a count, so a stored count above zero means "yes".
  // null = not answered yet. The stored count defaults to 0 for everyone, so a
  // 0 cannot tell "no" from "never asked": only a real count reads as "yes", and
  // "no" has to be tapped to be an answer.
  const [hasChildren, setHasChildren] = useState<boolean | null>(
    data.hasChildren || (data.numberOfChildren ?? 0) > 0 ? true : null,
  );
  const [childrenCount, setChildrenCount] = useState(
    data.numberOfChildren ? String(data.numberOfChildren) : '',
  );

  const isValid = !!maritalStatus;

  const selectMarital = (key: MaritalStatus) => {
    if (key === maritalStatus) return; // re-tapping the current choice is not a commit
    haptics.light();
    setMaritalStatus(key);
  };

  const selectChildren = (value: boolean) => {
    if (value === hasChildren) return;
    haptics.light();
    setHasChildren(value);
    // The count field appears with no focus move of its own, so say so.
    if (value) AccessibilityInfo.announceForAccessibility(t('onboarding.step7.childrenCount'));
  };

  const handleContinue = async () => {
    const parsed = Number(childrenCount);
    const entered = hasChildren === true && childrenCount !== '' && Number.isFinite(parsed) ? parsed : null;
    // Only an explicit "No" records 0. "Yes" with no count typed leaves the stored
    // count alone (0 would say "no children" to someone who just said they have
    // some), and an unanswered question is not an answer, so it writes nothing.
    const numberOfChildren = hasChildren === false ? 0 : entered;
    const profilePatch: JourneyProfilePatch = { maritalStatus };
    if (numberOfChildren !== null) profilePatch.numberOfChildren = numberOfChildren;
    await saveAndNext(
      { maritalStatus, hasChildren: hasChildren === true, numberOfChildren },
      profilePatch,
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
        <Text variant="subhead" color="textPrimary" style={styles.label}>{t('onboarding.step7.status')}</Text>
        <View
          style={styles.optionsContainer}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('onboarding.step7.status')}
        >
          {MARITAL_OPTIONS.map((opt) => {
            const isActive = maritalStatus === opt.key;
            return (
              <PressableScale
                key={opt.key}
                style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                onPress={() => selectMarital(opt.key)}
                testID={`marital-${opt.key}`}
                accessibilityLabel={t(opt.tKey)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive, selected: isActive }}
                pressRetentionOffset={RETAIN}
              >
                <Text variant="subhead" color={isActive ? 'primary' : 'textPrimary'}>
                  {t(opt.tKey)}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Children */}
      <View>
        <Text variant="subhead" color="textPrimary" style={styles.label}>{t('onboarding.step7.children')}</Text>
        <View
          style={styles.row}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('onboarding.step7.children')}
        >
          <PressableScale
            style={[styles.yesNoBtn, hasChildren === false && styles.yesNoBtnActive]}
            onPress={() => selectChildren(false)}
            testID="children-no"
            accessibilityLabel={t('common.no')}
            accessibilityRole="radio"
            accessibilityState={{ checked: hasChildren === false, selected: hasChildren === false }}
            pressRetentionOffset={RETAIN}
          >
            <Text variant="subhead" color={hasChildren === false ? 'primary' : 'textPrimary'}>
              {t('common.no')}
            </Text>
          </PressableScale>
          <PressableScale
            style={[styles.yesNoBtn, hasChildren === true && styles.yesNoBtnActive]}
            onPress={() => selectChildren(true)}
            testID="children-yes"
            accessibilityLabel={t('common.yes')}
            accessibilityRole="radio"
            accessibilityState={{ checked: hasChildren === true, selected: hasChildren === true }}
            pressRetentionOffset={RETAIN}
          >
            <Text variant="subhead" color={hasChildren === true ? 'primary' : 'textPrimary'}>
              {t('common.yes')}
            </Text>
          </PressableScale>
        </View>
      </View>

      {/* Number of children */}
      {hasChildren === true && (
        <Input
          label={t('onboarding.step7.childrenCount')}
          containerStyle={flushField}
          value={childrenCount}
          onChangeText={setChildrenCount}
          placeholder="0"
          keyboardType="number-pad"
          maxLength={1}
          testID="input-childrenCount"
          accessibilityLabel={t('onboarding.step7.childrenCount')}
        />
      )}
    </OnboardingLayout>
  );
}

const makeStyles = (c: ThemeColours, tap: number) => StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  optionsContainer: { gap: spacing.sm },
  // minHeight, not height, plus vertical padding: a longer hi/pa label or a
  // larger OS text size wraps to a second line with room around it.
  optionBtn: {
    minHeight: Math.max(52, tap),
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  optionBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
  row: { flexDirection: 'row', gap: spacing.sm },
  yesNoBtn: {
    flex: 1,
    minHeight: tap,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  yesNoBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
});
