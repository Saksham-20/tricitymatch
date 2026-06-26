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
  TextInput,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { colours, type, spacing, borderRadius } from '@shared/constants/theme';
import { Button, Switch } from '../ui';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import type { SearchFilters, Diet, MaritalStatus, ManglikStatus } from '../../types';

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

function toggleArray<T>(arr: T[] | undefined, val: T): T[] {
  const current = arr ?? [];
  return current.includes(val) ? current.filter((x) => x !== val) : [...current, val];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  return (
    <TouchableOpacity style={[sh.row, { borderBottomColor: c.hairline }]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[sh.title, { color: c.fgStrong }]}>{title}</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.textSecondary} />
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 0.5 },
  title: { ...type.headline },
});

function ChipGroup<T extends string>({ options, selected, onToggle }: {
  options: { label: string; value: T }[]; selected: T[] | undefined; onToggle: (val: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={cg.wrap}>
      {options.map((o) => {
        const active = (selected ?? []).includes(o.value);
        return (
          <TouchableOpacity
            key={o.value}
            style={[
              cg.chip,
              { backgroundColor: c.surface2, borderColor: c.border },
              active && { backgroundColor: colours.accentSoft, borderColor: colours.accent },
            ]}
            onPress={() => { haptics.light(); onToggle(o.value); }}
            accessibilityLabel={o.label}
          >
            <Text style={[cg.label, { color: c.textPrimary }, active && cg.labelActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const cg = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: borderRadius.pill, borderWidth: 1 },
  label: { ...type.subhead },
  labelActive: { color: colours.accent, fontFamily: 'Inter-SemiBold' },
});

function RangeRow({ label, min, max, absMin, absMax, onChangeMin, onChangeMax, unit }: {
  label: string; min: number; max: number; absMin: number; absMax: number;
  onChangeMin: (v: number) => void; onChangeMax: (v: number) => void; unit?: string;
}) {
  const { c } = useTheme();
  const [minText, setMinText] = useState(String(min));
  const [maxText, setMaxText] = useState(String(max));
  const inputStyle = [rr.input, { borderColor: c.border, color: c.fgStrong, backgroundColor: c.surfaceCard }];

  return (
    <View style={rr.container}>
      <Text style={[rr.label, { color: c.fgStrong }]}>{label}</Text>
      <View style={rr.row}>
        <View style={rr.inputWrap}>
          <Text style={[rr.sublabel, { color: c.textMuted }]}>Min{unit ? ` (${unit})` : ''}</Text>
          <TextInput
            style={inputStyle}
            value={minText}
            onChangeText={(t) => { setMinText(t); const n = parseInt(t, 10); if (!isNaN(n) && n >= absMin && n <= max) onChangeMin(n); }}
            keyboardType="number-pad"
            accessibilityLabel={`${label} minimum`}
            returnKeyType="done"
          />
        </View>
        <Text style={[rr.dash, { color: c.textMuted }]}>–</Text>
        <View style={rr.inputWrap}>
          <Text style={[rr.sublabel, { color: c.textMuted }]}>Max{unit ? ` (${unit})` : ''}</Text>
          <TextInput
            style={inputStyle}
            value={maxText}
            onChangeText={(t) => { setMaxText(t); const n = parseInt(t, 10); if (!isNaN(n) && n >= min && n <= absMax) onChangeMax(n); }}
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
  label: { ...type.subhead, fontFamily: 'Inter-Medium', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inputWrap: { flex: 1 },
  sublabel: { ...type.caption, marginBottom: 4 },
  input: { borderWidth: 1.5, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...type.body, textAlign: 'center' },
  dash: { ...type.title3, marginTop: 16 },
});

function GotraTagInput({ excluded, onChange }: { excluded: string[]; onChange: (v: string[]) => void }) {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const add = () => { const v = text.trim(); if (v && !excluded.includes(v)) onChange([...excluded, v]); setText(''); };
  return (
    <View style={gt.container}>
      <Text style={[gt.label, { color: c.fgStrong }]}>Exclude Gotra</Text>
      <View style={gt.row}>
        <TextInput
          style={[gt.input, { borderColor: c.border, color: c.fgStrong, backgroundColor: c.surfaceCard }]}
          value={text}
          onChangeText={setText}
          placeholder="Type gotra name..."
          placeholderTextColor={c.textMuted}
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
          {excluded.map((x) => (
            <View key={x} style={gt.chip}>
              <Text style={gt.chipText}>{x}</Text>
              <TouchableOpacity onPress={() => onChange(excluded.filter((y) => y !== x))} accessibilityLabel={`Remove ${x}`}>
                <Ionicons name="close-circle" size={14} color={colours.accent} />
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
  label: { ...type.subhead, fontFamily: 'Inter-Medium', marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1, borderWidth: 1.5, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...type.body },
  addBtn: { width: 44, height: 44, backgroundColor: colours.accent, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colours.accentSoft, borderRadius: borderRadius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText: { ...type.caption, color: colours.accent, fontFamily: 'Inter-Medium' },
});

function RadioGroup<T>({ options, selected, onSelect }: {
  options: { label: string; value: T }[]; selected: T | undefined; onSelect: (val: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={radio.container}>
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <TouchableOpacity key={String(o.value ?? 'any')} style={radio.option} onPress={() => onSelect(o.value)} accessibilityLabel={o.label}>
            <View style={[radio.dot, { borderColor: active ? colours.accent : c.border }]}>
              {active && <View style={radio.dotFill} />}
            </View>
            <Text style={[radio.label, { color: active ? c.fgStrong : c.textSecondary }, active && radio.labelActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const radio = StyleSheet.create({
  container: { paddingVertical: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: colours.accent },
  label: { ...type.body },
  labelActive: { fontFamily: 'Inter-Medium' },
});

// ─── Main FilterPanel ─────────────────────────────────────────────────────────

const FilterPanel = forwardRef<FilterPanelHandle, Props>(({
  filters, onChange, resultCount, loadingCount, onApply, onReset, onSaveSearch,
}, ref) => {
  const { c } = useTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const [sections, setSections] = useState({
    demographics: true, community: false, location: false, education: false, lifestyle: false, cultural: false,
  });

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.expand(),
    close: () => sheetRef.current?.close(),
  }));

  const toggle = (key: keyof typeof sections) => setSections((s) => ({ ...s, [key]: !s[key] }));
  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />, []
  );
  const update = (partial: Partial<SearchFilters>) => onChange({ ...filters, ...partial });

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: c.sheetBg }}
      handleIndicatorStyle={[styles.handle, { backgroundColor: c.n300 }]}
    >
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        <Text style={[styles.headerTitle, { color: c.fgStrong }]}>Filters</Text>
        <TouchableOpacity onPress={onReset} accessibilityLabel="Reset all filters">
          <Text style={styles.resetText}>Reset all</Text>
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Section title="Demographics" expanded={sections.demographics} onToggle={() => toggle('demographics')} />
        {sections.demographics && (
          <View>
            <RangeRow label="Age Range" min={filters.ageMin ?? 18} max={filters.ageMax ?? 65} absMin={18} absMax={65}
              onChangeMin={(v) => update({ ageMin: v })} onChangeMax={(v) => update({ ageMax: v })} unit="yrs" />
            <RangeRow label="Height Range" min={filters.heightMin ?? 140} max={filters.heightMax ?? 210} absMin={140} absMax={210}
              onChangeMin={(v) => update({ heightMin: v })} onChangeMax={(v) => update({ heightMax: v })} unit="cm" />
            <Text style={[styles.subLabel, { color: c.fgStrong }]}>Marital Status</Text>
            <ChipGroup options={MARITAL} selected={filters.maritalStatus} onToggle={(v) => update({ maritalStatus: toggleArray(filters.maritalStatus, v) })} />
          </View>
        )}

        <Section title="Community" expanded={sections.community} onToggle={() => toggle('community')} />
        {sections.community && (
          <View>
            <Text style={[styles.subLabel, { color: c.fgStrong }]}>Religion</Text>
            <ChipGroup options={RELIGIONS.map((r) => ({ label: r, value: r }))} selected={filters.religion ? [filters.religion] : []}
              onToggle={(v) => update({ religion: filters.religion === v ? undefined : v })} />
            <GotraTagInput excluded={filters.excludeGotra ?? []} onChange={(v) => update({ excludeGotra: v })} />
          </View>
        )}

        <Section title="Location" expanded={sections.location} onToggle={() => toggle('location')} />
        {sections.location && (
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={[styles.subLabel, { color: c.fgStrong }]}>NRI Only</Text>
              <Switch value={false} onValueChange={() => {}} />
            </View>
            <Text style={[styles.hint, { color: c.textMuted }]}>City filter: use the Search bar for location-specific results.</Text>
          </View>
        )}

        <Section title="Education & Career" expanded={sections.education} onToggle={() => toggle('education')} />
        {sections.education && (
          <View>
            <Text style={[styles.subLabel, { color: c.fgStrong }]}>Min Education</Text>
            <ChipGroup options={EDUCATION_LEVELS.map((e) => ({ label: e, value: e }))} selected={filters.education ? [filters.education] : []}
              onToggle={(v) => update({ education: filters.education === v ? undefined : v })} />
            <Text style={[styles.subLabel, { color: c.fgStrong }]}>Profession</Text>
            <ChipGroup options={PROFESSIONS.map((p) => ({ label: p, value: p }))} selected={filters.profession ? [filters.profession] : []}
              onToggle={(v) => update({ profession: filters.profession === v ? undefined : v })} />
          </View>
        )}

        <Section title="Lifestyle" expanded={sections.lifestyle} onToggle={() => toggle('lifestyle')} />
        {sections.lifestyle && (
          <View>
            <Text style={[styles.subLabel, { color: c.fgStrong }]}>Diet</Text>
            <ChipGroup options={DIETS} selected={filters.diet} onToggle={(v) => update({ diet: toggleArray(filters.diet, v) })} />
          </View>
        )}

        <Section title="Cultural" expanded={sections.cultural} onToggle={() => toggle('cultural')} />
        {sections.cultural && (
          <View>
            <Text style={[styles.subLabel, { color: c.fgStrong }]}>Manglik Preference</Text>
            <RadioGroup options={MANGLIK} selected={filters.manglikStatus} onSelect={(v) => update({ manglikStatus: v })} />
            <View style={styles.switchRow}>
              <Text style={[styles.subLabel, { color: c.fgStrong }]}>Verified profiles only</Text>
              <Switch value={filters.isVerified ?? false} onValueChange={(v) => update({ isVerified: v })} />
            </View>
          </View>
        )}

        <View style={styles.bottomPad} />
      </BottomSheetScrollView>

      <View style={[styles.footer, { borderTopColor: c.hairline, backgroundColor: c.sheetBg }]}>
        {onSaveSearch && (
          <Button title="Save search" variant="secondary" icon="bookmark-outline" onPress={onSaveSearch} />
        )}
        <Button
          title={resultCount !== undefined ? `Show ${resultCount} profiles` : 'Apply'}
          loading={loadingCount}
          onPress={() => { sheetRef.current?.close(); onApply(); }}
        />
      </View>
    </BottomSheet>
  );
});

FilterPanel.displayName = 'FilterPanel';
export default FilterPanel;

const styles = StyleSheet.create({
  handle: { width: 38 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingVertical: spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { ...type.title3, fontFamily: 'PlayfairDisplay-Bold' },
  resetText: { ...type.subhead, color: colours.accent, fontFamily: 'Inter-SemiBold' },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing['2xl'] },
  section: { paddingVertical: spacing.sm },
  subLabel: { ...type.subhead, fontFamily: 'Inter-Medium', marginTop: spacing.sm, marginBottom: 2 },
  hint: { ...type.caption },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  bottomPad: { height: 80 },
  footer: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.md, borderTopWidth: 0.5, gap: spacing.sm },
});
