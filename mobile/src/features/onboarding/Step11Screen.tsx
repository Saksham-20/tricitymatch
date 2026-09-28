import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { AccessibilityInfo, Platform, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Text from '../../components/ui/Text';
import PickerSheet, { type PickerOption } from '../../components/ui/PickerSheet';
import { Button } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import { tapSize } from '../../utils/elderTheme';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { queryKeys } from '../../constants/queryKeys';
import { getMyProfile } from '../../api/profile';
import OnboardingLayout, { OnboardingSelectField } from './OnboardingLayout';
import { useOnboarding, type JourneyProfilePatch } from './OnboardingContext';
import type { MaritalStatus, Diet, Profile } from '../../types';

// A drifting finger must not cancel a press (doctrine §10.8).
const RETAIN = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const AGE_MIN = 18;
const AGE_MAX = 65;
const HEIGHT_MIN = 140;
const HEIGHT_MAX = 213;

// The "Any" row at the top of every picker list. It is a real row so a pick made
// by mistake can be undone; it maps back to "not chosen" (null / '') and is never
// stored as a value itself. 0 is not a valid age or height, and ANY_KEY is not a
// valid education or manglik value, so neither can collide with a real option.
const ANY_NUMBER = 0;
const ANY_KEY = '__any__';

// Heights are stored in cm but picked (and shown) per inch, matching web.
const CM_PER_INCH = 2.54;
const inchesToCm = (inches: number) => Math.round(inches * CM_PER_INCH);
/** Snap any stored cm value onto the per-inch lattice the sheet offers. */
const snapCm = (cm: number) => inchesToCm(Math.round(cm / CM_PER_INCH));
function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / CM_PER_INCH);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
}

const ageOptions = (from: number, to: number): PickerOption<number>[] => {
  const out: PickerOption<number>[] = [];
  for (let v = from; v <= to; v += 1) out.push({ label: String(v), value: v });
  return out;
};

const heightOptions = (fromCm: number, toCm: number): PickerOption<number>[] => {
  const out: PickerOption<number>[] = [];
  const last = Math.round(toCm / CM_PER_INCH);
  for (let i = Math.round(fromCm / CM_PER_INCH); i <= last; i += 1) {
    const cm = inchesToCm(i);
    out.push({ label: cmToFtIn(cm), value: cm });
  }
  return out;
};

/**
 * The four range ends. `null` is "not chosen": it reads as "Any" and is never
 * sent, so this screen cannot write a range the member did not pick.
 */
interface PrefRange {
  ageMin: number | null;
  ageMax: number | null;
  heightMin: number | null;
  heightMax: number | null;
}

/** The profile column each range end is saved to. */
const END_FIELD = {
  ageMin: 'preferredAgeMin',
  ageMax: 'preferredAgeMax',
  heightMin: 'preferredHeightMin',
  heightMax: 'preferredHeightMax',
} as const;

/**
 * Fill the ends the member has not chosen from what the profile already holds
 * (the journey context does not hydrate preferences). A saved end is skipped if
 * it would invert a range against an end the member picked in the meantime, and
 * an end the member set back to "Any" (`cleared`) stays cleared.
 */
function seedRange(prev: PrefRange, saved: Partial<Profile>, cleared: ReadonlySet<keyof PrefRange>): PrefRange {
  const next = { ...prev };
  const sAgeMin = saved.preferredAgeMin ?? null;
  const sAgeMax = saved.preferredAgeMax ?? null;
  const sHMin = saved.preferredHeightMin != null ? snapCm(saved.preferredHeightMin) : null;
  const sHMax = saved.preferredHeightMax != null ? snapCm(saved.preferredHeightMax) : null;
  if (!cleared.has('ageMin') && next.ageMin == null && sAgeMin != null && (next.ageMax == null || sAgeMin <= next.ageMax)) next.ageMin = sAgeMin;
  if (!cleared.has('ageMax') && next.ageMax == null && sAgeMax != null && (next.ageMin == null || sAgeMax >= next.ageMin)) next.ageMax = sAgeMax;
  if (!cleared.has('heightMin') && next.heightMin == null && sHMin != null && (next.heightMax == null || sHMin <= next.heightMax)) next.heightMin = sHMin;
  if (!cleared.has('heightMax') && next.heightMax == null && sHMax != null && (next.heightMin == null || sHMax >= next.heightMin)) next.heightMax = sHMax;
  return next;
}

/** Older builds saved the sheet's "Any" row as if it were a required qualification. */
const isLegacyAny = (v?: string | null) => !!v && v.trim().toLowerCase() === 'any';

// --- Select field: a labelled button that opens the shared single-select sheet ---
interface SelectFieldProps<T extends string | number> {
  /** Small line above the value ("From" / "To"). */
  caption?: string;
  valueText: string;
  /** Renders the value muted (nothing chosen yet). */
  placeholder?: boolean;
  /** Title of the sheet. */
  title: string;
  options: ReadonlyArray<string | PickerOption<T>>;
  selected: unknown;
  onSelect: (v: T | string) => void;
  testID: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

// Kept local only for the From / To pair: it sits two-across with the caption
// INSIDE the button, and it names the whole group to a screen reader ("Age range,
// From"), neither of which OnboardingSelectField can express yet. It carries the
// same hint and expanded state that field gives a screen reader.
function SelectField<T extends string | number = string>({
  caption, valueText, placeholder = false, title, options, selected, onSelect,
  testID, accessibilityLabel, style,
}: SelectFieldProps<T>) {
  const { c, elder } = useTheme();
  const { t } = useTranslation();
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c, tap), [c, tap]);
  const [open, setOpen] = useState(false);

  return (
    <View style={style}>
      <PressableScale
        style={styles.selectBtn}
        onPress={() => setOpen(true)}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: valueText }}
        accessibilityHint={t('onboarding.selectHint', 'Opens a list of options')}
        accessibilityState={{ expanded: open }}
        pressRetentionOffset={RETAIN}
      >
        <View style={styles.selectBody}>
          {caption ? <Text variant="caption" color="textSecondary">{caption}</Text> : null}
          <Text variant="callout" color={placeholder ? 'textSecondary' : 'textPrimary'}>{valueText}</Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={18}
          color={c.textSecondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </PressableScale>
      <PickerSheet<T>
        visible={open}
        title={title}
        options={options}
        selected={selected}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/**
 * Shown when the saved profile could not be loaded, so the empty fields below are
 * not misread as "no preferences saved yet". Nothing is overwritten (only ends the
 * member picked are sent), which is why the form stays usable behind it.
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

// --- Multi-select pills ---
interface MultiSelectPillsProps<T extends string> {
  label: string;
  options: { key: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
  /** "Any" clears the selection. */
  onClear: () => void;
  anyLabel: string;
  optionTestPrefix?: string;
  anyTestID?: string;
}

function MultiSelectPills<T extends string>({
  label, options, selected, onToggle, onClear, anyLabel,
  optionTestPrefix = 'multi', anyTestID = 'multiselect-any',
}: MultiSelectPillsProps<T>) {
  const { c, elder } = useTheme();
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c, tap), [c, tap]);
  const isAny = selected.length === 0;
  return (
    <View>
      <Text variant="subhead" color="textPrimary" style={styles.label}>{label}</Text>
      <View style={styles.pillRow}>
        <PressableScale
          style={[styles.pill, isAny && styles.pillActive]}
          onPress={() => {
            if (isAny) return; // already "Any": nothing to commit
            haptics.light();
            onClear();
          }}
          testID={anyTestID}
          accessibilityLabel={anyLabel}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isAny }}
          pressRetentionOffset={RETAIN}
        >
          <Text variant="subhead" color={isAny ? 'primary' : 'textPrimary'}>{anyLabel}</Text>
        </PressableScale>
        {options.map((opt) => {
          const active = selected.includes(opt.key);
          return (
            <PressableScale
              key={opt.key}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => { haptics.light(); onToggle(opt.key); }}
              testID={`${optionTestPrefix}-${opt.key}`}
              accessibilityLabel={opt.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              pressRetentionOffset={RETAIN}
            >
              <Text variant="subhead" color={active ? 'primary' : 'textPrimary'}>{opt.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

// --- Data ---
const MARITAL_KEYS: MaritalStatus[] = ['never_married', 'divorced', 'widowed'];

const RELIGIONS = ['Hindu', 'Sikh', 'Muslim', 'Christian', 'Jain', 'Buddhist', 'Other'];

// Real levels only. The picker adds its own "Any" row (ANY_KEY) in front, which
// means "no minimum" and is never stored: the literal string "Any" used to be
// saved as if it were a required qualification.
const EDUCATION_LEVELS = [
  '10th', '12th', 'Graduate', 'Post-Graduate', 'PhD',
];

const DIET_OPTIONS: { key: Diet; label: string }[] = [
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'non-vegetarian', label: 'Non-Veg' },
  { key: 'jain', label: 'Jain' },
  { key: 'vegan', label: 'Vegan' },
];

// Stored strings; the labels shown are localised in the component.
const MANGLIK_ONLY = 'Manglik Only';
const MANGLIK_NON = 'Non-Manglik Only';

export default function Step11Screen() {
  const { c, elder } = useTheme();
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c, tap), [c, tap]);
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  // Ends the member has not chosen stay empty ("Any") instead of showing a
  // made-up 22 to 35 that would then be saved as their answer.
  const [range, setRange] = useState<PrefRange>({
    ageMin: data.preferredAgeMin,
    ageMax: data.preferredAgeMax,
    heightMin: data.preferredHeightMin != null ? snapCm(data.preferredHeightMin) : null,
    heightMax: data.preferredHeightMax != null ? snapCm(data.preferredHeightMax) : null,
  });
  const [marital, setMarital] = useState<MaritalStatus[]>(data.preferredMaritalStatus);
  const [religions, setReligions] = useState<string[]>(data.preferredReligion);
  const [education, setEducation] = useState(data.preferredEducation);
  const [diet, setDiet] = useState<Diet[]>(data.preferredDiet);
  // Older builds stored the picker's literal "Any" row as the answer.
  const [manglik, setManglik] = useState(isLegacyAny(data.preferredManglik) ? '' : data.preferredManglik);
  const [educationSheet, setEducationSheet] = useState(false);
  const [manglikSheet, setManglikSheet] = useState(false);
  // Ends (and the education level) the member set back to "Any". A saved value
  // must not be re-filled over that, and clearing it has to reach the server.
  const clearedEnds = useRef(new Set<keyof PrefRange>());
  const educationCleared = useRef(false);

  // A member who already saved a range or a level (on web, or in an earlier pass)
  // sees it here rather than an empty screen. Only unchosen ends are filled, so a
  // late response never undoes something just picked.
  const {
    data: saved,
    isError: savedError,
    isFetching: savedFetching,
    refetch: refetchSaved,
  } = useQuery({ queryKey: queryKeys.myProfile, queryFn: getMyProfile });
  useEffect(() => {
    if (!saved) return;
    setRange((prev) => seedRange(prev, saved, clearedEnds.current));
    if (!educationCleared.current) {
      setEducation((prev) => prev || (isLegacyAny(saved.preferredEducation) ? '' : saved.preferredEducation ?? ''));
    }
  }, [saved]);
  const savedFailed = !saved && savedError && !savedFetching;

  // Pick a value for one range end, or set it back to "Any" (not chosen).
  const setEnd = (key: keyof PrefRange, value: number | string) => {
    const n = Number(value);
    if (n === ANY_NUMBER) {
      clearedEnds.current.add(key);
      setRange((r) => ({ ...r, [key]: null }));
    } else {
      clearedEnds.current.delete(key);
      setRange((r) => ({ ...r, [key]: n }));
    }
  };

  const toggleMarital = (v: MaritalStatus) =>
    setMarital((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const toggleReligion = (v: string) =>
    setReligions((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const toggleDiet = (v: Diet) =>
    setDiet((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const handleContinue = async () => {
    // Only what was chosen (or already saved) is sent. An unset end means "Any",
    // which is not a value to write over one the profile may already hold.
    const profilePatch: JourneyProfilePatch = {};
    (Object.keys(END_FIELD) as (keyof PrefRange)[]).forEach((end) => {
      const value = range[end];
      // An end the member set back to "Any" clears what was saved for it.
      if (value != null) profilePatch[END_FIELD[end]] = value;
      else if (clearedEnds.current.has(end)) profilePatch[END_FIELD[end]] = null;
    });
    if (education) profilePatch.preferredEducation = education;
    // Clear the stray "Any" an older build saved, so other members stop seeing a
    // requirement that was never chosen; likewise a level the member cleared here.
    else if (
      isLegacyAny(saved?.preferredEducation)
      || (educationCleared.current && (!saved || !!saved.preferredEducation))
    ) profilePatch.preferredEducation = '';
    await saveAndNext(
      {
        preferredAgeMin: range.ageMin, preferredAgeMax: range.ageMax,
        preferredHeightMin: range.heightMin, preferredHeightMax: range.heightMax,
        preferredMaritalStatus: marital, preferredReligion: religions,
        preferredEducation: education, preferredDiet: diet,
        preferredManglik: manglik,
      },
      profilePatch,
    );
  };

  const anyLabel = t('onboarding.step11.any');
  const fromLabel = t('onboarding.step11.from', 'From');
  const toLabel = t('onboarding.step11.to', 'To');
  const ageRangeLabel = t('onboarding.step11.ageRange');
  const heightRangeLabel = t('onboarding.step11.heightRange');
  const formatAge = (v: number) => t('onboarding.step11.ageValue', { count: v, defaultValue: '{{count}} yrs' });

  const anyNumber: PickerOption<number> = { label: anyLabel, value: ANY_NUMBER };
  const ageList = (from: number, to: number): PickerOption<number>[] => [
    anyNumber,
    ...ageOptions(from, to).map((o) => ({ ...o, label: formatAge(o.value) })),
  ];
  const heightList = (from: number, to: number): PickerOption<number>[] => [
    anyNumber,
    ...heightOptions(from, to),
  ];
  const educationOptions: PickerOption<string>[] = [
    { label: anyLabel, value: ANY_KEY },
    ...EDUCATION_LEVELS.map((level) => ({ label: level, value: level })),
  ];
  const manglikOptions: PickerOption<string>[] = [
    { label: anyLabel, value: ANY_KEY },
    { label: t('onboarding.step11.manglikOnly', 'Manglik only'), value: MANGLIK_ONLY },
    { label: t('onboarding.step11.nonManglikOnly', 'Non-Manglik only'), value: MANGLIK_NON },
  ];
  const manglikLabel = manglikOptions.find((o) => o.value === manglik)?.label ?? '';

  const maritalOptions = MARITAL_KEYS.map((key) => ({
    key,
    label: t(`onboarding.step7.statusOptions.${key}`),
  }));
  const religionOptions = RELIGIONS.map((r) => ({ key: r, label: r }));
  const dietOptions = DIET_OPTIONS.map((o) => ({
    key: o.key,
    label: t(`onboarding.step8.dietOptions.${o.key}`, o.label),
  }));

  return (
    <OnboardingLayout
      step={11}
      title={t('onboarding.step11.title')}
      subtitle={t('onboarding.step11.subtitle')}
      onContinue={handleContinue}
      skippable
      onSkip={handleSkip}
    >
      {savedFailed ? <SavedLoadNotice onRetry={() => { refetchSaved(); }} /> : null}

      {/* Age range: two pickers, never an inverted range (each list stops at the other bound) */}
      <View>
        <Text variant="subhead" color="textPrimary" style={styles.label}>{ageRangeLabel}</Text>
        <View style={styles.rangeRow}>
          <SelectField<number>
            style={styles.rangeItem}
            caption={fromLabel}
            valueText={range.ageMin != null ? formatAge(range.ageMin) : anyLabel}
            placeholder={range.ageMin == null}
            title={`${ageRangeLabel}: ${fromLabel}`}
            options={ageList(AGE_MIN, range.ageMax ?? AGE_MAX)}
            selected={range.ageMin ?? ANY_NUMBER}
            onSelect={(v) => setEnd('ageMin', v)}
            testID="select-ageMin"
            accessibilityLabel={`${ageRangeLabel}, ${fromLabel}`}
          />
          <SelectField<number>
            style={styles.rangeItem}
            caption={toLabel}
            valueText={range.ageMax != null ? formatAge(range.ageMax) : anyLabel}
            placeholder={range.ageMax == null}
            title={`${ageRangeLabel}: ${toLabel}`}
            options={ageList(range.ageMin ?? AGE_MIN, Math.max(AGE_MAX, range.ageMax ?? 0))}
            selected={range.ageMax ?? ANY_NUMBER}
            onSelect={(v) => setEnd('ageMax', v)}
            testID="select-ageMax"
            accessibilityLabel={`${ageRangeLabel}, ${toLabel}`}
          />
        </View>
      </View>

      {/* Height range */}
      <View>
        <Text variant="subhead" color="textPrimary" style={styles.label}>{heightRangeLabel}</Text>
        <View style={styles.rangeRow}>
          <SelectField<number>
            style={styles.rangeItem}
            caption={fromLabel}
            valueText={range.heightMin != null ? cmToFtIn(range.heightMin) : anyLabel}
            placeholder={range.heightMin == null}
            title={`${heightRangeLabel}: ${fromLabel}`}
            options={heightList(HEIGHT_MIN, range.heightMax ?? HEIGHT_MAX)}
            selected={range.heightMin ?? ANY_NUMBER}
            onSelect={(v) => setEnd('heightMin', v)}
            testID="select-heightMin"
            accessibilityLabel={`${heightRangeLabel}, ${fromLabel}`}
          />
          <SelectField<number>
            style={styles.rangeItem}
            caption={toLabel}
            valueText={range.heightMax != null ? cmToFtIn(range.heightMax) : anyLabel}
            placeholder={range.heightMax == null}
            title={`${heightRangeLabel}: ${toLabel}`}
            options={heightList(range.heightMin ?? HEIGHT_MIN, Math.max(HEIGHT_MAX, range.heightMax ?? 0))}
            selected={range.heightMax ?? ANY_NUMBER}
            onSelect={(v) => setEnd('heightMax', v)}
            testID="select-heightMax"
            accessibilityLabel={`${heightRangeLabel}, ${toLabel}`}
          />
        </View>
      </View>

      {/* Marital status */}
      <MultiSelectPills
        label={t('onboarding.step11.maritalStatus')}
        options={maritalOptions}
        selected={marital}
        onToggle={toggleMarital}
        onClear={() => setMarital([])}
        anyLabel={anyLabel}
      />

      {/* Religion */}
      <MultiSelectPills
        label={t('onboarding.step11.religion')}
        options={religionOptions}
        selected={religions}
        onToggle={toggleReligion}
        onClear={() => setReligions([])}
        anyLabel={anyLabel}
        optionTestPrefix="religion"
        anyTestID="religion-any"
      />

      {/* Min education */}
      <OnboardingSelectField
        label={t('onboarding.step11.education')}
        value={education}
        placeholder={t('onboarding.step11.minEducation', 'Minimum education level')}
        onPress={() => setEducationSheet(true)}
        open={educationSheet}
        testID="select-prefEducation"
      />

      {/* Diet */}
      <MultiSelectPills
        label={t('onboarding.step11.diet')}
        options={dietOptions}
        selected={diet}
        onToggle={toggleDiet}
        onClear={() => setDiet([])}
        anyLabel={anyLabel}
        anyTestID="multiselect-any-diet"
      />

      {/* Manglik preference */}
      <OnboardingSelectField
        label={t('onboarding.step11.manglik')}
        value={manglikLabel}
        placeholder={anyLabel}
        onPress={() => setManglikSheet(true)}
        open={manglikSheet}
        testID="select-prefManglik"
      />

      <PickerSheet
        visible={educationSheet}
        title={t('onboarding.step11.education')}
        options={educationOptions}
        selected={education || ANY_KEY}
        onSelect={(v) => {
          const next = v === ANY_KEY ? '' : String(v);
          educationCleared.current = next === '';
          setEducation(next);
        }}
        onClose={() => setEducationSheet(false)}
      />
      <PickerSheet
        visible={manglikSheet}
        title={t('onboarding.step11.manglik')}
        options={manglikOptions}
        selected={manglik || ANY_KEY}
        onSelect={(v) => setManglik(v === ANY_KEY ? '' : String(v))}
        onClose={() => setManglikSheet(false)}
      />
    </OnboardingLayout>
  );
}

const makeStyles = (c: ThemeColours, tap: number) => StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  rangeRow: { flexDirection: 'row', gap: spacing.sm },
  rangeItem: { flex: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.full,
    minHeight: tap,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
  selectBtn: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: tap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectBody: { flex: 1 },
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
