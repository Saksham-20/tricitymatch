import React, {
  useCallback,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import type { SearchFilters, Diet, MaritalStatus, ManglikStatus } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterPanelHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  resultCount?: number;
  loadingCount?: boolean;
  onApply: () => void;
  onReset: () => void;
  onSaveSearch?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RELIGIONS = ['Hindu', 'Sikh', 'Muslim', 'Christian', 'Jain', 'Buddhist', 'Other'];
const DIETS: { label: string; value: Diet }[] = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Non-Veg', value: 'non-vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Jain', value: 'jain' },
];
const MARITAL: { label: string; value: MaritalStatus }[] = [
  { label: 'Never Married', value: 'never_married' },
  { label: 'Divorced', value: 'divorced' },
  { label: 'Widowed', value: 'widowed' },
  { label: 'Awaiting Divorce', value: 'awaiting_divorce' },
];
const MANGLIK: { label: string; value: ManglikStatus | undefined }[] = [
  { label: 'Any', value: undefined },
  { label: 'Manglik Only', value: 'manglik' },
  { label: 'Non-Manglik Only', value: 'non_manglik' },
];
const PROFESSIONS = [
  'Doctor', 'Engineer', 'Teacher', 'Business', 'Government', 'IT Professional',
  'Lawyer', 'Accountant', 'Nurse', 'Architect', 'Designer', 'Other',
];
const EDUCATION_LEVELS = ['10th', '12th', 'Graduate', 'Post-Graduate', 'PhD'];
const SNAP_POINTS = ['50%', '92%'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggleArray<T>(arr: T[] | undefined, val: T): T[] {
  const current = arr ?? [];
  return current.includes(val) ? current.filter((x) => x !== val) : [...current, val];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  expanded,
  onToggle,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={sh.row} onPress={onToggle} activeOpacity={0.7}>
      <Text style={sh.title}>{title}</Text>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={colours.textSecondary}
      />
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
});

function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { label: string; value: T }[];
  selected: T[] | undefined;
  onToggle: (val: T) => void;
}) {
  return (
    <View style={cg.wrap}>
      {options.map((o) => {
        const active = (selected ?? []).includes(o.value);
        return (
          <TouchableOpacity
            key={o.value}
            style={[cg.chip, active && cg.chipActive]}
            onPress={() => onToggle(o.value)}
            accessibilityLabel={o.label}
          >
            <Text style={[cg.label, active && cg.labelActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const cg = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.background,
  },
  chipActive: { backgroundColor: colours.primary, borderColor: colours.primary },
  label: { fontSize: typography.fontSize.sm, color: colours.textSecondary, fontFamily: typography.fontFamily.regular },
  labelActive: { color: '#fff', fontFamily: typography.fontFamily.semiBold },
});

function RangeRow({
  label,
  min,
  max,
  absMin,
  absMax,
  onChangeMin,
  onChangeMax,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  absMin: number;
  absMax: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
  unit?: string;
}) {
  const [minText, setMinText] = useState(String(min));
  const [maxText, setMaxText] = useState(String(max));

  return (
    <View style={rr.container}>
      <Text style={rr.label}>{label}</Text>
      <View style={rr.row}>
        <View style={rr.inputWrap}>
          <Text style={rr.sublabel}>Min{unit ? ` (${unit})` : ''}</Text>
          <TextInput
            style={rr.input}
            value={minText}
            onChangeText={(t) => {
              setMinText(t);
              const n = parseInt(t, 10);
              if (!isNaN(n) && n >= absMin && n <= max) onChangeMin(n);
            }}
            keyboardType="number-pad"
            accessibilityLabel={`${label} minimum`}
            returnKeyType="done"
          />
        </View>
        <Text style={rr.dash}>–</Text>
        <View style={rr.inputWrap}>
          <Text style={rr.sublabel}>Max{unit ? ` (${unit})` : ''}</Text>
          <TextInput
            style={rr.input}
            value={maxText}
            onChangeText={(t) => {
              setMaxText(t);
              const n = parseInt(t, 10);
              if (!isNaN(n) && n >= min && n <= absMax) onChangeMax(n);
            }}
            keyboardType="number-pad"
            accessibilityLabel={`${label} maximum`}
            returnKeyType="done"
          />
        </View>
      </View>
    </View>
  );
}
const rr = StyleSheet.create({
  container: { paddingVertical: spacing.sm },
  label: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: colours.textPrimary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inputWrap: { flex: 1 },
  sublabel: { fontSize: typography.fontSize.xs, color: colours.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
  dash: { fontSize: typography.fontSize.lg, color: colours.textMuted, marginTop: 16 },
});

// ─── GotraTagInput ─────────────────────────────────────────────────────────

function GotraTagInput({
  excluded,
  onChange,
}: {
  excluded: string[];
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState('');

  const add = () => {
    const val = text.trim();
    if (val && !excluded.includes(val)) {
      onChange([...excluded, val]);
    }
    setText('');
  };

  return (
    <View style={gt.container}>
      <Text style={gt.label}>Exclude Gotra</Text>
      <View style={gt.row}>
        <TextInput
          style={gt.input}
          value={text}
          onChangeText={setText}
          placeholder="Type gotra name..."
          placeholderTextColor={colours.textMuted}
          returnKeyType="done"
          onSubmitEditing={add}
          accessibilityLabel="Gotra exclusion input"
        />
        <TouchableOpacity style={gt.addBtn} onPress={add} accessibilityLabel="Add gotra">
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {excluded.length > 0 && (
        <View style={gt.chips}>
          {excluded.map((g) => (
            <View key={g} style={gt.chip}>
              <Text style={gt.chipText}>{g}</Text>
              <TouchableOpacity
                onPress={() => onChange(excluded.filter((x) => x !== g))}
                accessibilityLabel={`Remove ${g}`}
              >
                <Ionicons name="close-circle" size={14} color={colours.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
const gt = StyleSheet.create({
  container: { paddingVertical: spacing.sm },
  label: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: colours.textPrimary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.regular,
  },
  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: colours.primary,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipText: { fontSize: typography.fontSize.xs, color: colours.primary, fontFamily: typography.fontFamily.medium },
});

// ─── RadioGroup ───────────────────────────────────────────────────────────────

function RadioGroup<T>({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: T }[];
  selected: T | undefined;
  onSelect: (val: T) => void;
}) {
  return (
    <View style={radio.container}>
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <TouchableOpacity
            key={String(o.value ?? 'any')}
            style={[radio.option, active && radio.optionActive]}
            onPress={() => onSelect(o.value)}
            accessibilityLabel={o.label}
          >
            <View style={[radio.dot, active && radio.dotActive]}>
              {active && <View style={radio.dotFill} />}
            </View>
            <Text style={[radio.label, active && radio.labelActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const radio = StyleSheet.create({
  container: { paddingVertical: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionActive: {},
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colours.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: colours.primary },
  dotFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: colours.primary },
  label: { fontSize: typography.fontSize.base, color: colours.textSecondary, fontFamily: typography.fontFamily.regular },
  labelActive: { color: colours.textPrimary, fontFamily: typography.fontFamily.medium },
});

// ─── Main FilterPanel ─────────────────────────────────────────────────────────

const FilterPanel = forwardRef<FilterPanelHandle, Props>(({
  filters,
  onChange,
  resultCount,
  loadingCount,
  onApply,
  onReset,
  onSaveSearch,
}, ref) => {
  const sheetRef = useRef<BottomSheet>(null);
  const [sections, setSections] = useState({
    demographics: true,
    community: false,
    location: false,
    education: false,
    lifestyle: false,
    cultural: false,
  });

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.expand(),
    close: () => sheetRef.current?.close(),
  }));

  const toggle = (key: keyof typeof sections) =>
    setSections((s) => ({ ...s, [key]: !s[key] }));

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    []
  );

  const update = (partial: Partial<SearchFilters>) => onChange({ ...filters, ...partial });

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Filters</Text>
        <TouchableOpacity onPress={onReset} accessibilityLabel="Reset all filters">
          <Text style={styles.resetText}>Reset All</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable content */}
      <BottomSheetScrollView contentContainerStyle={styles.content}>

        {/* Demographics */}
        <SectionHeader title="Demographics" expanded={sections.demographics} onToggle={() => toggle('demographics')} />
        {sections.demographics && (
          <View>
            <RangeRow
              label="Age Range"
              min={filters.ageMin ?? 18}
              max={filters.ageMax ?? 65}
              absMin={18}
              absMax={65}
              onChangeMin={(v) => update({ ageMin: v })}
              onChangeMax={(v) => update({ ageMax: v })}
              unit="yrs"
            />
            <RangeRow
              label="Height Range"
              min={filters.heightMin ?? 140}
              max={filters.heightMax ?? 210}
              absMin={140}
              absMax={210}
              onChangeMin={(v) => update({ heightMin: v })}
              onChangeMax={(v) => update({ heightMax: v })}
              unit="cm"
            />
            <Text style={styles.subLabel}>Marital Status</Text>
            <ChipGroup
              options={MARITAL}
              selected={filters.maritalStatus}
              onToggle={(v) => update({ maritalStatus: toggleArray(filters.maritalStatus, v) })}
            />
          </View>
        )}

        {/* Community */}
        <SectionHeader title="Community" expanded={sections.community} onToggle={() => toggle('community')} />
        {sections.community && (
          <View>
            <Text style={styles.subLabel}>Religion</Text>
            <ChipGroup
              options={RELIGIONS.map((r) => ({ label: r, value: r }))}
              selected={filters.religion ? [filters.religion] : []}
              onToggle={(v) => update({ religion: filters.religion === v ? undefined : v })}
            />
            <GotraTagInput
              excluded={filters.excludeGotra ?? []}
              onChange={(v) => update({ excludeGotra: v })}
            />
          </View>
        )}

        {/* Location */}
        <SectionHeader title="Location" expanded={sections.location} onToggle={() => toggle('location')} />
        {sections.location && (
          <View style={styles.section}>
            <View style={styles.nriRow}>
              <Text style={styles.subLabel}>NRI Only</Text>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: colours.border, true: colours.primary }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.hint}>City filter: use Search bar for location-specific results.</Text>
          </View>
        )}

        {/* Education & Career */}
        <SectionHeader title="Education & Career" expanded={sections.education} onToggle={() => toggle('education')} />
        {sections.education && (
          <View>
            <Text style={styles.subLabel}>Min Education</Text>
            <ChipGroup
              options={EDUCATION_LEVELS.map((e) => ({ label: e, value: e }))}
              selected={filters.education ? [filters.education] : []}
              onToggle={(v) => update({ education: filters.education === v ? undefined : v })}
            />
            <Text style={styles.subLabel}>Profession</Text>
            <ChipGroup
              options={PROFESSIONS.map((p) => ({ label: p, value: p }))}
              selected={filters.profession ? [filters.profession] : []}
              onToggle={(v) => update({ profession: filters.profession === v ? undefined : v })}
            />
          </View>
        )}

        {/* Lifestyle */}
        <SectionHeader title="Lifestyle" expanded={sections.lifestyle} onToggle={() => toggle('lifestyle')} />
        {sections.lifestyle && (
          <View>
            <Text style={styles.subLabel}>Diet</Text>
            <ChipGroup
              options={DIETS}
              selected={filters.diet}
              onToggle={(v) => update({ diet: toggleArray(filters.diet, v) })}
            />
          </View>
        )}

        {/* Cultural */}
        <SectionHeader title="Cultural" expanded={sections.cultural} onToggle={() => toggle('cultural')} />
        {sections.cultural && (
          <View>
            <Text style={styles.subLabel}>Manglik Preference</Text>
            <RadioGroup
              options={MANGLIK}
              selected={filters.manglikStatus}
              onSelect={(v) => update({ manglikStatus: v })}
            />
            <View style={styles.verifiedRow}>
              <Text style={styles.subLabel}>Verified profiles only</Text>
              <Switch
                value={filters.isVerified ?? false}
                onValueChange={(v) => update({ isVerified: v })}
                trackColor={{ false: colours.border, true: colours.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        )}

        <View style={styles.bottomPad} />
      </BottomSheetScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {onSaveSearch && (
          <TouchableOpacity style={styles.saveBtn} onPress={onSaveSearch} accessibilityLabel="Save search">
            <Ionicons name="bookmark-outline" size={18} color={colours.primary} />
            <Text style={styles.saveBtnText}>Save Search</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => {
            sheetRef.current?.close();
            onApply();
          }}
          accessibilityLabel="Apply filters"
        >
          {loadingCount ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.applyBtnText}>
              {resultCount !== undefined ? `Show ${resultCount} profiles` : 'Apply'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
});

FilterPanel.displayName = 'FilterPanel';
export default FilterPanel;

const styles = StyleSheet.create({
  handle: { backgroundColor: colours.border, width: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  resetText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  section: { paddingVertical: spacing.sm },
  subLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
  },
  nriRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  verifiedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  bottomPad: { height: 80 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colours.border,
    gap: spacing.sm,
    backgroundColor: colours.background,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colours.primary,
  },
  saveBtnText: {
    fontSize: typography.fontSize.base,
    color: colours.primary,
    fontFamily: typography.fontFamily.semiBold,
  },
  applyBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  applyBtnText: {
    fontSize: typography.fontSize.base,
    color: '#fff',
    fontFamily: typography.fontFamily.bold,
  },
});
