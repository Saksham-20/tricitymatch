import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { Button, Input, Switch } from '../ui';
import Text from '../ui/Text';
import { useUIStore } from '../../stores/uiStore';
import { useTheme } from '../../hooks/useTheme';
import { PressableScale } from '../motion';
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
    <PressableScale
      style={[sh.row, { borderBottomColor: c.hairline }]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text variant="headline" color="fgStrong">{title}</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.textSecondary} />
    </PressableScale>
  );
}
const sh = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 0.5 },
});

function ChipGroup<T extends string>({ options, selected, onToggle }: {
  options: { label: string; value: T }[]; selected: T[] | undefined; onToggle: (val: T) => void;
}) {
  const { c } = useTheme();
  const cg = React.useMemo(() => makeCg(c), [c]);
  return (
    <View style={cg.wrap}>
      {options.map((o) => {
        const active = (selected ?? []).includes(o.value);
        return (
          <PressableScale
            key={o.value}
            style={[
              cg.chip,
              { backgroundColor: c.surface2, borderColor: c.border },
              active && { backgroundColor: c.accentSoft, borderColor: c.accent },
            ]}
            onPress={() => onToggle(o.value)}
            haptic
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {/* c.accent is the 'primary' alias (identical hex) — resolved via the dynamic colour prop; the active-state weight bump stays a style override */}
            <Text variant="subhead" color={active ? 'primary' : 'textPrimary'} style={[cg.label, active && cg.labelActive]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
const makeCg = (c: ThemeColours) => StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: borderRadius.pill, borderWidth: 1 },
  label: {},
  labelActive: { fontFamily: 'Inter-SemiBold' },
});

function RangeRow({ label, min, max, absMin, absMax, onChangeMin, onChangeMax, unit }: {
  label: string; min: number; max: number; absMin: number; absMax: number;
  onChangeMin: (v: number) => void; onChangeMax: (v: number) => void; unit?: string;
}) {
  const [minText, setMinText] = useState(String(min));
  const [maxText, setMaxText] = useState(String(max));

  return (
    <View style={rr.container}>
      <Text variant="subhead" color="fgStrong" style={rr.label}>{label}</Text>
      <View style={rr.row}>
        <Input
          label={`Min${unit ? ` (${unit})` : ''}`}
          containerStyle={rr.inputWrap}
          style={rr.inputText}
          value={minText}
          onChangeText={(t) => { setMinText(t); const n = parseInt(t, 10); if (!isNaN(n) && n >= absMin && n <= max) onChangeMin(n); }}
          keyboardType="number-pad"
          accessibilityLabel={`${label} minimum`}
          returnKeyType="done"
        />
        <Text variant="title3" color="textMuted" style={rr.dash}>–</Text>
        <Input
          label={`Max${unit ? ` (${unit})` : ''}`}
          containerStyle={rr.inputWrap}
          style={rr.inputText}
          value={maxText}
          onChangeText={(t) => { setMaxText(t); const n = parseInt(t, 10); if (!isNaN(n) && n >= min && n <= absMax) onChangeMax(n); }}
          keyboardType="number-pad"
          accessibilityLabel={`${label} maximum`}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}
const rr = StyleSheet.create({
  container: { paddingVertical: spacing.sm },
  label: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inputWrap: { flex: 1, marginBottom: 0 },
  inputText: { textAlign: 'center' },
  dash: { marginTop: 16 },
});

function GotraTagInput({ excluded, onChange }: { excluded: string[]; onChange: (v: string[]) => void }) {
  const { c } = useTheme();
  const gt = React.useMemo(() => makeGt(c), [c]);
  const [text, setText] = useState('');
  const add = () => { const v = text.trim(); if (v && !excluded.includes(v)) onChange([...excluded, v]); setText(''); };
  return (
    <View style={gt.container}>
      <Text variant="subhead" color="fgStrong" style={gt.label}>Exclude Gotra</Text>
      <View style={gt.row}>
        <Input
          containerStyle={gt.inputWrap}
          value={text}
          onChangeText={setText}
          placeholder="Type gotra name..."
          returnKeyType="done"
          onSubmitEditing={add}
          accessibilityLabel="Gotra exclusion input"
        />
        <PressableScale
          style={gt.addBtn}
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel="Add gotra"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </PressableScale>
      </View>
      {excluded.length > 0 && (
        <View style={gt.chips}>
          {excluded.map((x) => (
            <View key={x} style={gt.chip}>
              {/* c.accent is the 'primary' alias (identical hex) */}
              <Text variant="caption" color="primary" style={gt.chipText}>{x}</Text>
              <PressableScale
                onPress={() => onChange(excluded.filter((y) => y !== x))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${x}`}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={14} color={c.accent} />
              </PressableScale>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
const makeGt = (c: ThemeColours) => StyleSheet.create({
  container: { paddingVertical: spacing.sm },
  label: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  inputWrap: { flex: 1, marginBottom: 0 },
  addBtn: { width: 44, height: 44, backgroundColor: c.accent, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accentSoft, borderRadius: borderRadius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText: { fontFamily: 'Inter-Medium' },
});

function RadioGroup<T>({ options, selected, onSelect }: {
  options: { label: string; value: T }[]; selected: T | undefined; onSelect: (val: T) => void;
}) {
  const { c } = useTheme();
  const radio = React.useMemo(() => makeRadio(c), [c]);
  return (
    <View style={radio.container}>
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <PressableScale
            key={String(o.value ?? 'any')}
            style={radio.option}
            onPress={() => onSelect(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[radio.dot, { borderColor: active ? c.accent : c.border }]}>
              {active && <View style={radio.dotFill} />}
            </View>
            <Text variant="body" color={active ? 'fgStrong' : 'textSecondary'} style={[radio.label, active && radio.labelActive]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
const makeRadio = (c: ThemeColours) => StyleSheet.create({
  container: { paddingVertical: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
  label: {},
  labelActive: { fontFamily: 'Inter-Medium' },
});

// ─── Main FilterPanel ─────────────────────────────────────────────────────────

const FilterPanel = forwardRef<FilterPanelHandle, Props>(({
  filters, onChange, resultCount, loadingCount, onApply, onReset, onSaveSearch,
}, ref) => {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const sheetRef = useRef<BottomSheet>(null);
  const [sections, setSections] = useState({
    demographics: true, community: false, location: false, education: false, lifestyle: false, cultural: false,
  });
  // gorhom v5 keeps a CLOSED sheet's backdrop mounted full-screen and clickable
  // (accessibility dump: Button "Bottom sheet backdrop" [0,136][1080,2337]),
  // which silently swallowed every touch on the Search screen. Track openness in
  // React state and only render the backdrop while the sheet is actually open.
  const [sheetOpen, setSheetOpen] = useState(false);

  // Tell the floating tab bar to get out of the way — it is absolutely
  // positioned over the whole screen and otherwise covers this sheet's own
  // "Save search" and "Show N profiles" buttons.
  const setBottomSheetOpen = useUIStore((st) => st.setBottomSheetOpen);
  useEffect(() => {
    setBottomSheetOpen(sheetOpen);
    // Unmounting while open must not leave the tab bar hidden for good.
    return () => setBottomSheetOpen(false);
  }, [sheetOpen, setBottomSheetOpen]);

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.expand(),
    close: () => sheetRef.current?.close(),
  }));

  const toggle = (key: keyof typeof sections) => setSections((s) => ({ ...s, [key]: !s[key] }));
  const renderBackdrop = useCallback(
    (props: any) =>
      sheetOpen ? <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} /> : null,
    [sheetOpen]
  );
  const update = (partial: Partial<SearchFilters>) => onChange({ ...filters, ...partial });

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      // v5 defaults enableDynamicSizing to TRUE, which with fixed snapPoints
      // mis-measures the closed sheet: its invisible container swallowed every
      // touch on the Search screen (list, filters, search box all dead).
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={(i) => setSheetOpen(i >= 0)}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: c.sheetBg }}
      handleIndicatorStyle={[styles.handle, { backgroundColor: c.n300 }]}
    >
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        {/* deliberately serif (Playfair) for this sheet heading — mapped to title2, which natively carries that face at 22/28 instead of title3's Inter-SemiBold 20/25 */}
        <Text variant="title2" color="fgStrong">Filters</Text>
        <PressableScale
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel="Reset all filters"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {/* c.accent is the 'primary' alias; the extra SemiBold weight over subhead's own Medium is a deliberate emphasis override */}
          <Text variant="subhead" color="primary" style={styles.resetText}>Reset all</Text>
        </PressableScale>
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Section title="Demographics" expanded={sections.demographics} onToggle={() => toggle('demographics')} />
        {sections.demographics && (
          <View>
            <RangeRow label="Age Range" min={filters.ageMin ?? 18} max={filters.ageMax ?? 65} absMin={18} absMax={65}
              onChangeMin={(v) => update({ ageMin: v })} onChangeMax={(v) => update({ ageMax: v })} unit="yrs" />
            <RangeRow label="Height Range" min={filters.heightMin ?? 140} max={filters.heightMax ?? 210} absMin={140} absMax={210}
              onChangeMin={(v) => update({ heightMin: v })} onChangeMax={(v) => update({ heightMax: v })} unit="cm" />
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Marital Status</Text>
            <ChipGroup options={MARITAL} selected={filters.maritalStatus} onToggle={(v) => update({ maritalStatus: toggleArray(filters.maritalStatus, v) })} />
          </View>
        )}

        <Section title="Community" expanded={sections.community} onToggle={() => toggle('community')} />
        {sections.community && (
          <View>
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Religion</Text>
            <ChipGroup options={RELIGIONS.map((r) => ({ label: r, value: r }))} selected={filters.religion ? [filters.religion] : []}
              onToggle={(v) => update({ religion: filters.religion === v ? undefined : v })} />
            <GotraTagInput excluded={filters.excludeGotra ?? []} onChange={(v) => update({ excludeGotra: v })} />
          </View>
        )}

        <Section title="Location" expanded={sections.location} onToggle={() => toggle('location')} />
        {sections.location && (
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text variant="subhead" color="fgStrong" style={styles.subLabel}>NRI Only</Text>
              <Switch value={false} onValueChange={() => {}} />
            </View>
            <Text variant="caption" color="textMuted">City filter: use the Search bar for location-specific results.</Text>
          </View>
        )}

        <Section title="Education & Career" expanded={sections.education} onToggle={() => toggle('education')} />
        {sections.education && (
          <View>
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Min Education</Text>
            <ChipGroup options={EDUCATION_LEVELS.map((e) => ({ label: e, value: e }))} selected={filters.education ? [filters.education] : []}
              onToggle={(v) => update({ education: filters.education === v ? undefined : v })} />
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Profession</Text>
            <ChipGroup options={PROFESSIONS.map((p) => ({ label: p, value: p }))} selected={filters.profession ? [filters.profession] : []}
              onToggle={(v) => update({ profession: filters.profession === v ? undefined : v })} />
          </View>
        )}

        <Section title="Lifestyle" expanded={sections.lifestyle} onToggle={() => toggle('lifestyle')} />
        {sections.lifestyle && (
          <View>
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Diet</Text>
            <ChipGroup options={DIETS} selected={filters.diet} onToggle={(v) => update({ diet: toggleArray(filters.diet, v) })} />
          </View>
        )}

        <Section title="Cultural" expanded={sections.cultural} onToggle={() => toggle('cultural')} />
        {sections.cultural && (
          <View>
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Manglik Preference</Text>
            <RadioGroup options={MANGLIK} selected={filters.manglikStatus} onSelect={(v) => update({ manglikStatus: v })} />
            <View style={styles.switchRow}>
              <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Verified profiles only</Text>
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

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  handle: { width: 38 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingVertical: spacing.md, borderBottomWidth: 0.5 },
  resetText: { fontFamily: 'Inter-SemiBold' },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing['2xl'] },
  section: { paddingVertical: spacing.sm },
  subLabel: { marginTop: spacing.sm, marginBottom: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  bottomPad: { height: 80 },
  footer: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.md, borderTopWidth: 0.5, gap: spacing.sm },
});
