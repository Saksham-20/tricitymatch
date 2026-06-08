import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, FlatList,
  PanResponder, PanResponderGestureState, LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

const TRACK_WIDTH_FALLBACK = 280;
const THUMB_SIZE = 28;
const AGE_MIN = 18;
const AGE_MAX = 65;
const HEIGHT_MIN = 140;
const HEIGHT_MAX = 213;

function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
}

interface RangeSliderProps {
  min: number;
  max: number;
  low: number;
  high: number;
  onLowChange: (v: number) => void;
  onHighChange: (v: number) => void;
  formatLabel: (v: number) => string;
  testID?: string;
}

function RangeSlider({ min, max, low, high, onLowChange, onHighChange, formatLabel, testID }: RangeSliderProps) {
  const trackWidth = useRef(TRACK_WIDTH_FALLBACK);

  const posFromVal = (v: number) => ((v - min) / (max - min)) * trackWidth.current;
  const valFromPos = (pos: number) => {
    const raw = (pos / trackWidth.current) * (max - min) + min;
    return Math.round(Math.max(min, Math.min(max, raw)));
  };

  const lowPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, gs: PanResponderGestureState) => {
        const basePos = posFromVal(low);
        const newVal = valFromPos(basePos + gs.dx);
        if (newVal < high) onLowChange(newVal);
      },
    }),
  ).current;

  const highPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, gs: PanResponderGestureState) => {
        const basePos = posFromVal(high);
        const newVal = valFromPos(basePos + gs.dx);
        if (newVal > low) onHighChange(newVal);
      },
    }),
  ).current;

  const lowPos = posFromVal(low);
  const highPos = posFromVal(high);

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => {
        trackWidth.current = e.nativeEvent.layout.width - THUMB_SIZE;
      }}
      style={styles.sliderContainer}
    >
      {/* Labels */}
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabel}>{formatLabel(low)}</Text>
        <Text style={styles.sliderLabel}>{formatLabel(high)}</Text>
      </View>

      {/* Track */}
      <View style={styles.track}>
        {/* Filled range */}
        <View
          style={[
            styles.trackFill,
            { left: lowPos + THUMB_SIZE / 2, width: Math.max(0, highPos - lowPos) },
          ]}
        />
        {/* Low thumb */}
        <View
          {...lowPanResponder.panHandlers}
          style={[styles.thumb, { left: lowPos }]}
          accessibilityLabel={`Minimum ${formatLabel(low)}`}
          accessibilityRole="adjustable"
        />
        {/* High thumb */}
        <View
          {...highPanResponder.panHandlers}
          style={[styles.thumb, { left: highPos }]}
          accessibilityLabel={`Maximum ${formatLabel(high)}`}
          accessibilityRole="adjustable"
        />
      </View>
    </View>
  );
}

// --- Multi-select pills ---
interface MultiSelectPillsProps<T extends string> {
  label: string;
  options: { key: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
  anyAllowed?: boolean;
}

function MultiSelectPills<T extends string>({
  label, options, selected, onToggle, anyAllowed = false,
}: MultiSelectPillsProps<T>) {
  const isAny = selected.length === 0;
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillRow}>
        {anyAllowed && (
          <TouchableOpacity
            style={[styles.pill, isAny && styles.pillActive]}
            onPress={() => {
              // clear = any
              options.forEach((o) => {
                if (selected.includes(o.key)) onToggle(o.key);
              });
            }}
            testID="multiselect-any"
            accessibilityLabel="Any"
          >
            <Text style={[styles.pillText, isAny && styles.pillTextActive]}>Any</Text>
          </TouchableOpacity>
        )}
        {options.map((opt) => {
          const active = selected.includes(opt.key);
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onToggle(opt.key)}
              testID={`multi-${opt.key}`}
              accessibilityLabel={opt.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// --- Picker sheet ---
interface PickerSheetProps {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}

function PickerSheet({ visible, title, options, selected, onSelect, onClose }: PickerSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sheetRow, item === selected && styles.sheetRowActive]}
              onPress={() => { onSelect(item); onClose(); }}
              testID={`option-${item}`}
            >
              <Text style={[styles.sheetRowText, item === selected && styles.sheetRowTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

// --- Data ---
import type { MaritalStatus, Diet } from '../../types';

const MARITAL_OPTIONS: { key: MaritalStatus; label: string }[] = [
  { key: 'never_married', label: 'Never Married' },
  { key: 'divorced', label: 'Divorced' },
  { key: 'widowed', label: 'Widowed' },
];

const RELIGIONS = ['Hindu', 'Sikh', 'Muslim', 'Christian', 'Jain', 'Buddhist', 'Other'];

const EDUCATION_LEVELS = [
  'Any', '10th', '12th', 'Graduate', 'Post-Graduate', 'PhD',
];

const DIET_OPTIONS: { key: Diet; label: string }[] = [
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'non-vegetarian', label: 'Non-Veg' },
  { key: 'jain', label: 'Jain' },
  { key: 'vegan', label: 'Vegan' },
];

const MANGLIK_OPTIONS = ['Any', 'Manglik Only', 'Non-Manglik Only'];

export default function Step11Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [ageMin, setAgeMin] = useState(data.preferredAgeMin ?? 22);
  const [ageMax, setAgeMax] = useState(data.preferredAgeMax ?? 35);
  const [heightMin, setHeightMin] = useState(data.preferredHeightMin ?? 152);
  const [heightMax, setHeightMax] = useState(data.preferredHeightMax ?? 183);
  const [marital, setMarital] = useState<MaritalStatus[]>(data.preferredMaritalStatus);
  const [religions, setReligions] = useState<string[]>(data.preferredReligion);
  const [education, setEducation] = useState(data.preferredEducation);
  const [diet, setDiet] = useState<Diet[]>(data.preferredDiet);
  const [manglik, setManglik] = useState(data.preferredManglik);
  const [educationSheet, setEducationSheet] = useState(false);
  const [manglikSheet, setManglikSheet] = useState(false);

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
    await saveAndNext(
      {
        preferredAgeMin: ageMin, preferredAgeMax: ageMax,
        preferredHeightMin: heightMin, preferredHeightMax: heightMax,
        preferredMaritalStatus: marital, preferredReligion: religions,
        preferredEducation: education, preferredDiet: diet,
        preferredManglik: manglik,
      },
      {
        preferredAgeMin: ageMin, preferredAgeMax: ageMax,
        preferredHeightMin: heightMin, preferredHeightMax: heightMax,
        preferredEducation: education,
      } as any,
    );
  };

  return (
    <OnboardingLayout
      step={11}
      title={t('onboarding.step11.title')}
      subtitle={t('onboarding.step11.subtitle')}
      onContinue={handleContinue}
      skippable
      onSkip={handleSkip}
    >
      {/* Age range */}
      <View>
        <Text style={styles.label}>{t('onboarding.step11.ageRange')}</Text>
        <RangeSlider
          min={AGE_MIN} max={AGE_MAX}
          low={ageMin} high={ageMax}
          onLowChange={setAgeMin} onHighChange={setAgeMax}
          formatLabel={(v) => `${v} yrs`}
          testID="slider-age"
        />
      </View>

      {/* Height range */}
      <View>
        <Text style={styles.label}>{t('onboarding.step11.heightRange')}</Text>
        <RangeSlider
          min={HEIGHT_MIN} max={HEIGHT_MAX}
          low={heightMin} high={heightMax}
          onLowChange={setHeightMin} onHighChange={setHeightMax}
          formatLabel={cmToFtIn}
          testID="slider-height"
        />
      </View>

      {/* Marital status */}
      <MultiSelectPills
        label={t('onboarding.step11.maritalStatus')}
        options={MARITAL_OPTIONS}
        selected={marital}
        onToggle={toggleMarital}
        anyAllowed
      />

      {/* Religion */}
      <View>
        <Text style={styles.label}>{t('onboarding.step11.religion')}</Text>
        <View style={styles.pillRow}>
          <TouchableOpacity
            style={[styles.pill, religions.length === 0 && styles.pillActive]}
            onPress={() => setReligions([])}
            testID="religion-any"
          >
            <Text style={[styles.pillText, religions.length === 0 && styles.pillTextActive]}>Any</Text>
          </TouchableOpacity>
          {RELIGIONS.map((r) => {
            const active = religions.includes(r);
            return (
              <TouchableOpacity
                key={r}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => toggleReligion(r)}
                testID={`religion-${r}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Min education */}
      <View>
        <Text style={styles.label}>{t('onboarding.step11.education')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setEducationSheet(true)}
          testID="select-prefEducation"
          accessibilityLabel={t('onboarding.step11.education')}
        >
          <Text style={education ? styles.selectText : styles.placeholderText}>
            {education || 'Minimum education level'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Diet */}
      <MultiSelectPills
        label={t('onboarding.step11.diet')}
        options={DIET_OPTIONS}
        selected={diet}
        onToggle={toggleDiet}
        anyAllowed
      />

      {/* Manglik preference */}
      <View>
        <Text style={styles.label}>{t('onboarding.step11.manglik')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setManglikSheet(true)}
          testID="select-prefManglik"
          accessibilityLabel={t('onboarding.step11.manglik')}
        >
          <Text style={manglik ? styles.selectText : styles.placeholderText}>
            {manglik || 'Any'}
          </Text>
        </TouchableOpacity>
      </View>

      <PickerSheet
        visible={educationSheet}
        title={t('onboarding.step11.education')}
        options={EDUCATION_LEVELS}
        selected={education}
        onSelect={setEducation}
        onClose={() => setEducationSheet(false)}
      />
      <PickerSheet
        visible={manglikSheet}
        title={t('onboarding.step11.manglik')}
        options={MANGLIK_OPTIONS}
        selected={manglik}
        onSelect={setManglik}
        onClose={() => setManglikSheet(false)}
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
  sliderContainer: { paddingHorizontal: THUMB_SIZE / 2 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  sliderLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.primary,
  },
  track: {
    height: 6,
    backgroundColor: colours.border,
    borderRadius: borderRadius.full,
    position: 'relative',
    marginVertical: THUMB_SIZE / 2,
  },
  trackFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colours.primary,
    top: -(THUMB_SIZE / 2 - 3),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.full,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  pillText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  pillTextActive: { color: colours.primary },
  selectBtn: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  selectText: { fontSize: typography.fontSize.base, color: colours.textPrimary },
  placeholderText: { fontSize: typography.fontSize.base, color: colours.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colours.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
    paddingTop: spacing.lg,
  },
  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sheetRow: { height: 52, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  sheetRowActive: { backgroundColor: colours.primaryLight },
  sheetRowText: { fontSize: typography.fontSize.base, color: colours.textPrimary },
  sheetRowTextActive: { color: colours.primary, fontFamily: typography.fontFamily.semiBold },
});
