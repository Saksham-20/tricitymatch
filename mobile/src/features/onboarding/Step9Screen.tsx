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
import PickerSheet from '../../components/ui/PickerSheet';
import Text from '../../components/ui/Text';
import { Button } from '../../components/ui';
import OnboardingLayout, { OnboardingSelectField } from './OnboardingLayout';
import { useOnboarding, type JourneyProfilePatch } from './OnboardingContext';
import { queryKeys } from '../../constants/queryKeys';
import { getMyProfile } from '../../api/profile';
import type { FamilyType } from '../../types';

type FamilyValues = 'orthodox' | 'traditional' | 'moderate' | 'liberal';

// A drifting finger must not cancel a press (doctrine §10.8).
const RETAIN = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const COUNTER_MAX = 10;
// Room for "10" at title3 scaled to its 1.3x cap.
const COUNTER_VALUE_MIN_WIDTH = 32;

const OCCUPATIONS = [
  'Business / Self-employed', 'Government Employee', 'Private Sector',
  'Doctor / Healthcare', 'Teacher / Professor', 'Lawyer', 'Engineer',
  'Army / Defence', 'Police', 'Farmer / Agriculture',
  'Homemaker', 'Retired', 'Passed Away', 'Other',
];

const FAMILY_TYPES: FamilyType[] = ['nuclear', 'joint'];

const FAMILY_VALUES_OPTIONS: { key: FamilyValues; label: string }[] = [
  { key: 'orthodox', label: 'Orthodox' },
  { key: 'traditional', label: 'Traditional' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'liberal', label: 'Liberal' },
];

/**
 * Shown when the saved profile could not be loaded, so the empty fields below are
 * not misread as "nothing saved yet". Nothing here is overwritten (only answered
 * fields are sent), which is why the form stays usable behind it.
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

function CounterInput({
  label, value, onChange, testID,
}: { label: string; value: number; onChange: (v: number) => void; testID: string }) {
  const { c, elder } = useTheme();
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c, tap, elder), [c, tap, elder]);
  const { t } = useTranslation();

  // The new value appears without the screen reader's focus moving to it, so
  // say it out loud (announceForAccessibility works on both platforms).
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(COUNTER_MAX, value + delta));
    if (next === value) return;
    haptics.light();
    onChange(next);
    AccessibilityInfo.announceForAccessibility(`${label}: ${next}`);
  };

  return (
    <View>
      <Text variant="subhead" color="textPrimary" style={styles.label}>{label}</Text>
      <View style={styles.counterRow}>
        <PressableScale
          style={[styles.counterBtn, value <= 0 && styles.counterBtnOff]}
          onPress={() => step(-1)}
          testID={`${testID}-dec`}
          accessibilityLabel={t('onboarding.step9.decrease', { label, defaultValue: 'Decrease {{label}}' })}
          disabled={value <= 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: value <= 0 }}
          pressRetentionOffset={RETAIN}
        >
          <Ionicons name="remove" size={22} color={c.textPrimary} />
        </PressableScale>
        {/* Sits in a fixed-width row beside two 48pt buttons, so it may not grow past 1.3x. */}
        <Text
          variant="title3"
          color="textPrimary"
          maxScale={1.3}
          style={styles.counterValue}
          testID={testID}
          accessibilityLabel={`${label}: ${value}`}
        >
          {value}
        </Text>
        <PressableScale
          style={[styles.counterBtn, value >= COUNTER_MAX && styles.counterBtnOff]}
          onPress={() => step(1)}
          testID={`${testID}-inc`}
          accessibilityLabel={t('onboarding.step9.increase', { label, defaultValue: 'Increase {{label}}' })}
          disabled={value >= COUNTER_MAX}
          accessibilityRole="button"
          accessibilityState={{ disabled: value >= COUNTER_MAX }}
          pressRetentionOffset={RETAIN}
        >
          <Ionicons name="add" size={22} color={c.textPrimary} />
        </PressableScale>
      </View>
    </View>
  );
}

export default function Step9Screen() {
  const { c, elder } = useTheme();
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c, tap, elder), [c, tap, elder]);
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [fatherOccupation, setFatherOccupation] = useState(data.fatherOccupation);
  const [motherOccupation, setMotherOccupation] = useState(data.motherOccupation);
  const [brothers, setBrothers] = useState(data.numberOfBrothers);
  const [sisters, setSisters] = useState(data.numberOfSisters);
  const [familyType, setFamilyType] = useState<FamilyType | null>(data.familyType);
  const [familyValues, setFamilyValues] = useState<FamilyValues | null>(data.familyValues);
  const [fatherSheet, setFatherSheet] = useState(false);
  const [motherSheet, setMotherSheet] = useState(false);

  // The journey context does not hydrate these from the saved profile, so a member
  // who already answered elsewhere would see every field empty. Fill only the ones
  // still unanswered, so a late response never undoes a choice. The profile keeps
  // ONE sibling total, so the brothers / sisters split cannot be recovered and the
  // counters stay as they are (siblings are sent only when the member sets them).
  const {
    data: saved,
    isError: savedError,
    isFetching: savedFetching,
    refetch: refetchSaved,
  } = useQuery({ queryKey: queryKeys.myProfile, queryFn: getMyProfile });
  useEffect(() => {
    if (!saved) return;
    setFatherOccupation((prev) => prev || saved.fatherOccupation || '');
    setMotherOccupation((prev) => prev || saved.motherOccupation || '');
    setFamilyType((prev) => prev ?? saved.familyType ?? null);
  }, [saved]);
  const savedFailed = !saved && savedError && !savedFetching;

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const handleContinue = async () => {
    // Only send what was answered: an empty field means "no answer", not "clear it".
    // The profile stores one sibling total; brothers + sisters is that total.
    const siblings = brothers + sisters;
    const profilePatch: JourneyProfilePatch = {};
    if (fatherOccupation) profilePatch.fatherOccupation = fatherOccupation;
    if (motherOccupation) profilePatch.motherOccupation = motherOccupation;
    if (familyType) profilePatch.familyType = familyType;
    if (siblings > 0) profilePatch.numberOfSiblings = siblings;
    await saveAndNext(
      { fatherOccupation, motherOccupation, numberOfBrothers: brothers, numberOfSisters: sisters, familyType, familyValues },
      profilePatch,
    );
  };

  const selectPlaceholder = t('onboarding.step9.selectOccupation', 'Select occupation');

  return (
    <OnboardingLayout
      step={9}
      title={t('onboarding.step9.title')}
      subtitle={t('onboarding.step9.subtitle')}
      onContinue={handleContinue}
      skippable
      onSkip={handleSkip}
    >
      {savedFailed ? <SavedLoadNotice onRetry={() => { refetchSaved(); }} /> : null}

      {/* Father's occupation */}
      <OnboardingSelectField
        label={t('onboarding.step9.fatherOccupation')}
        optional
        value={fatherOccupation}
        placeholder={selectPlaceholder}
        onPress={() => setFatherSheet(true)}
        open={fatherSheet}
        testID="select-fatherOccupation"
      />

      {/* Mother's occupation */}
      <OnboardingSelectField
        label={t('onboarding.step9.motherOccupation')}
        optional
        value={motherOccupation}
        placeholder={selectPlaceholder}
        onPress={() => setMotherSheet(true)}
        open={motherSheet}
        testID="select-motherOccupation"
      />

      {/* Siblings */}
      <View style={styles.siblingRow}>
        <View style={styles.siblingItem}>
          <CounterInput
            label={t('onboarding.step9.brothers')}
            value={brothers}
            onChange={setBrothers}
            testID="counter-brothers"
          />
        </View>
        <View style={styles.siblingItem}>
          <CounterInput
            label={t('onboarding.step9.sisters')}
            value={sisters}
            onChange={setSisters}
            testID="counter-sisters"
          />
        </View>
      </View>

      {/* Family type */}
      <View>
        <Text variant="subhead" color="textPrimary" style={styles.label}>{t('onboarding.step9.familyType')}</Text>
        <View
          style={styles.pillRow}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('onboarding.step9.familyType')}
        >
          {FAMILY_TYPES.map((key) => {
            const active = familyType === key;
            const label = t(`onboarding.step9.familyTypeOptions.${key}`);
            return (
              <PressableScale
                key={key}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => {
                  if (active) return;
                  haptics.light();
                  setFamilyType(key);
                }}
                testID={`familyType-${key}`}
                accessibilityLabel={label}
                accessibilityRole="radio"
                accessibilityState={{ checked: active, selected: active }}
                pressRetentionOffset={RETAIN}
              >
                <Text variant="subhead" color={active ? 'primary' : 'textPrimary'}>{label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Family values */}
      <View>
        <Text variant="subhead" color="textPrimary" style={styles.label}>{t('onboarding.step9.familyValues')}</Text>
        <View
          style={styles.pillRow}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('onboarding.step9.familyValues')}
        >
          {FAMILY_VALUES_OPTIONS.map((opt) => {
            const active = familyValues === opt.key;
            const label = t(`onboarding.step9.familyValuesOptions.${opt.key}`, opt.label);
            return (
              <PressableScale
                key={opt.key}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => {
                  if (active) return;
                  haptics.light();
                  setFamilyValues(opt.key);
                }}
                testID={`familyValues-${opt.key}`}
                accessibilityLabel={label}
                accessibilityRole="radio"
                accessibilityState={{ checked: active, selected: active }}
                pressRetentionOffset={RETAIN}
              >
                <Text variant="subhead" color={active ? 'primary' : 'textPrimary'}>{label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <PickerSheet
        visible={fatherSheet}
        title={t('onboarding.step9.fatherOccupation')}
        options={OCCUPATIONS}
        selected={fatherOccupation}
        onSelect={setFatherOccupation}
        onClose={() => setFatherSheet(false)}
      />
      <PickerSheet
        visible={motherSheet}
        title={t('onboarding.step9.motherOccupation')}
        options={OCCUPATIONS}
        selected={motherOccupation}
        onSelect={setMotherOccupation}
        onClose={() => setMotherSheet(false)}
      />
    </OnboardingLayout>
  );
}

const makeStyles = (c: ThemeColours, tap: number, elder: boolean) => StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  // Two steppers at 48pt fit side by side on a 360dp phone; at the 60pt elder
  // target they do not, so elder mode stacks them. Below ~340dp (or with a
  // stepper any wider) they wrap onto their own lines instead of overlapping:
  // each item asks for exactly the width its row needs (a `flex: 1` item has a
  // zero basis, which never wraps). In a column a basis would be a height, so
  // elder leaves it off.
  siblingRow: { flexDirection: elder ? 'column' : 'row', flexWrap: 'wrap', gap: spacing.lg },
  siblingItem: elder
    ? {}
    : { flexGrow: 1, flexBasis: tap * 2 + COUNTER_VALUE_MIN_WIDTH + spacing.sm * 2 },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  counterBtn: {
    width: tap,
    height: tap,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnOff: { opacity: 0.4 },
  counterValue: {
    minWidth: COUNTER_VALUE_MIN_WIDTH,
    textAlign: 'center',
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
