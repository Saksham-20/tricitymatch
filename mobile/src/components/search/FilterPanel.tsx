import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Keyboard,
  View,
  StyleSheet,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import { Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { duration, EASE_DRAWER } from '@shared/constants/motion';
import { Button, Input, Switch } from '../ui';
import Text from '../ui/Text';
import { useUIStore } from '../../stores/uiStore';
import { useTheme } from '../../hooks/useTheme';
import { PressableScale } from '../motion';
import { tapSize } from '../../utils/elderTheme';
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
  { label: 'Non-veg', value: 'non-vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Jain', value: 'jain' },
];
const MARITAL: { label: string; value: MaritalStatus }[] = [
  { label: 'Never married', value: 'never_married' },
  { label: 'Divorced', value: 'divorced' },
  { label: 'Widowed', value: 'widowed' },
  { label: 'Awaiting divorce', value: 'awaiting_divorce' },
];
const MANGLIK: { label: string; value: ManglikStatus | undefined }[] = [
  { label: 'Any', value: undefined },
  { label: 'Manglik only', value: 'manglik' },
  { label: 'Non-manglik only', value: 'non_manglik' },
];
const PROFESSIONS = [
  'Doctor', 'Engineer', 'Teacher', 'Business', 'Government', 'IT Professional',
  'Lawyer', 'Accountant', 'Nurse', 'Architect', 'Designer', 'Other',
];
const SNAP_POINTS = ['50%', '92%'];

function toggleArray<T>(arr: T[] | undefined, val: T): T[] {
  const current = arr ?? [];
  return current.includes(val) ? current.filter((x) => x !== val) : [...current, val];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  const { c, elder } = useTheme();
  return (
    <PressableScale
      style={[sh.row, { borderBottomColor: c.hairline }, elder && { minHeight: tapSize(elder) }]}
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

function ChipGroup<T extends string>({ options, selected, onToggle, idPrefix }: {
  options: { label: string; value: T }[]; selected: T[] | undefined; onToggle: (val: T) => void;
  /** namespaces the chips' testIDs, since one label ("Other", "Jain") can appear in two groups */
  idPrefix: string;
}) {
  const { c, elder } = useTheme();
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
              // Elder mode's 60pt floor: the mark itself grows (the 4pt slop below stays for 44).
              elder && { minHeight: tapSize(elder), justifyContent: 'center' },
            ]}
            onPress={() => onToggle(o.value)}
            haptic
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            testID={`chip-${idPrefix}-${o.value}-tap44-hitslop`}
            // The chip is 36pt tall: 4 above and below reaches 44 without touching the
            // next row (the gap is 8). The old 6 reached 48 but overlapped its neighbours.
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {/* c.accent is the 'primary' alias (identical hex) — resolved via the dynamic colour prop.
                Active is signalled by fill, border and colour only: a heavier face (Inter-SemiBold)
                changes the chip's width, which re-wraps the row on every toggle. */}
            <Text variant="subhead" color={active ? 'primary' : 'textPrimary'}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
// Layout only: chip colours are applied inline from `useTheme()`.
const cg = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: borderRadius.pill, borderWidth: 1 },
});

function RangeRow({ label, min, max, absMin, absMax, onChangeMin, onChangeMax, unit }: {
  label: string; min: number; max: number; absMin: number; absMax: number;
  onChangeMin: (v: number) => void; onChangeMax: (v: number) => void; unit?: string;
}) {
  // Remounted by the panel's "Reset all" (see `resetCount`), which is what puts
  // these back to the defaults: the text lives here, so a reset of the filter
  // alone used to leave the typed digits on screen.
  const [minText, setMinText] = useState(String(min));
  const [maxText, setMaxText] = useState(String(max));
  const [minErr, setMinErr] = useState<string | undefined>();
  const [maxErr, setMaxErr] = useState<string | undefined>();

  // Out-of-range or non-numeric input is never applied. Say so on blur (not on
  // every keystroke: "2" is a fine step on the way to "25") and name the fix.
  const check = (text: string, lo: number, hi: number) => {
    const n = parseInt(text, 10);
    return isNaN(n) || n < lo || n > hi ? `Enter a number from ${lo} to ${hi}` : undefined;
  };

  return (
    <View style={rr.container}>
      <Text variant="subhead" color="fgStrong" style={rr.label}>{label}</Text>
      <View style={rr.row}>
        <Input
          label={`Min${unit ? ` (${unit})` : ''}`}
          containerStyle={rr.inputWrap}
          style={rr.inputText}
          value={minText}
          onChangeText={(t) => {
            setMinText(t);
            setMinErr(undefined);
            const n = parseInt(t, 10);
            if (!isNaN(n) && n >= absMin && n <= max) onChangeMin(n);
          }}
          onBlur={() => setMinErr(check(minText, absMin, max))}
          error={minErr}
          keyboardType="number-pad"
          accessibilityLabel={`${label} minimum`}
          returnKeyType="done"
        />
        {/* decorative range separator */}
        <Text variant="title3" color="textMuted" style={rr.dash} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">–</Text>
        <Input
          label={`Max${unit ? ` (${unit})` : ''}`}
          containerStyle={rr.inputWrap}
          style={rr.inputText}
          value={maxText}
          onChangeText={(t) => {
            setMaxText(t);
            setMaxErr(undefined);
            const n = parseInt(t, 10);
            if (!isNaN(n) && n >= min && n <= absMax) onChangeMax(n);
          }}
          onBlur={() => setMaxErr(check(maxText, min, absMax))}
          error={maxErr}
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

function RadioGroup<T>({ options, selected, onSelect }: {
  options: { label: string; value: T }[]; selected: T | undefined; onSelect: (val: T) => void;
}) {
  const { c, elder } = useTheme();
  const radio = React.useMemo(() => makeRadio(c), [c]);
  return (
    <View style={radio.container} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <PressableScale
            key={String(o.value ?? 'any')}
            style={[radio.option, elder && { minHeight: tapSize(elder) }]}
            onPress={() => onSelect(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active, checked: active }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[radio.dot, { borderColor: active ? c.accent : c.border }]}>
              {active && <View style={radio.dotFill} />}
            </View>
            <Text variant="body" color={active ? 'fgStrong' : 'textSecondary'}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
const makeRadio = (c: ThemeColours) => StyleSheet.create({
  container: { paddingVertical: spacing.xs },
  // 12 + 23 + 12 = 47pt: reaches 44 on its own. The old 8pt padding was 39pt and leaned
  // on a hitSlop that overlapped the row above and below (the rows have no gap).
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
});

// ─── Main FilterPanel ─────────────────────────────────────────────────────────

const FilterPanel = forwardRef<FilterPanelHandle, Props>(({
  filters, onChange, resultCount, loadingCount, onApply, onReset, onSaveSearch,
}, ref) => {
  const { c, elder } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const sheetRef = useRef<BottomSheet>(null);
  // No "Location" section: its only contents were an "NRI only" switch hard-wired to
  // `false` with an empty handler (it could never turn on) and a note telling members
  // to use the search box for cities, which searches by profile ID. Add it back when
  // there is a city/NRI filter the server honours.
  const [sections, setSections] = useState({
    demographics: true, community: false, career: false, lifestyle: false, cultural: false,
  });
  // Bumped by "Reset all" to remount the sections, which is how the range inputs'
  // own typed text (local state) goes back to the defaults along with the filters.
  const [resetCount, setResetCount] = useState(0);
  // Sheet motion from the token file (drawer curve, sheet duration), not gorhom's own defaults.
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: duration.sheet,
    easing: Easing.bezier(...EASE_DRAWER),
  });
  // gorhom v5 keeps a CLOSED sheet's backdrop mounted full-screen and clickable
  // (accessibility dump: Button "Bottom sheet backdrop" [0,136][1080,2337]),
  // which silently swallowed every touch on the Search screen. Track openness in
  // React state and only render the backdrop while the sheet is actually open.
  //
  // Timing matters: `onChange` fires when the animation ENDS, `onAnimate` when it
  // STARTS. Opening is flagged at the start (so the backdrop fades in with the sheet
  // instead of popping in at full opacity afterwards, and the floating pill is
  // already gone before it can draw over the footer buttons); closing is flagged at
  // the end (so the backdrop is still mounted to fade out).
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
    close: () => { Keyboard.dismiss(); sheetRef.current?.close(); },
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
      animationConfigs={animationConfigs}
      enablePanDownToClose
      onAnimate={(_from, to) => { if (to >= 0) setSheetOpen(true); }}
      // A range field still focused when the sheet closes keeps the IME 'shown' against a
      // sheet nobody can see, and Search below it lost its tab bar (seen on device).
      onChange={(i) => { setSheetOpen(i >= 0); if (i < 0) Keyboard.dismiss(); }}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: c.sheetBg }}
      // `n300` is 1.4:1 on the dark sheet, which hides the only cue that the sheet drags.
      handleIndicatorStyle={[styles.handle, { backgroundColor: c.textMuted }]}
    >
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        {/* deliberately serif (Playfair) for this sheet heading — mapped to title2, which natively carries that face at 22/28 instead of title3's Inter-SemiBold 20/25 */}
        <Text variant="title2" color="fgStrong" accessibilityRole="header" style={styles.headerTitle}>Filters</Text>
        <PressableScale
          style={elder ? { minHeight: tapSize(elder), justifyContent: 'center' } : undefined}
          onPress={() => { setResetCount((n) => n + 1); onReset(); }}
          accessibilityRole="button"
          accessibilityLabel="Reset all filters"
          testID="filter-reset-tap44-hitslop"
          // 20pt of text: 12 above and below reaches 44
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {/* c.accent is the 'primary' alias; the extra SemiBold weight over subhead's own Medium is a deliberate emphasis override */}
          <Text variant="subhead" color="primary" style={styles.resetText}>Reset all</Text>
        </PressableScale>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        // The age and height fields use a number pad, which has no Return key on iOS:
        // dragging the list is the way to put the keyboard away.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View key={resetCount}>
        <Section title="Demographics" expanded={sections.demographics} onToggle={() => toggle('demographics')} />
        {sections.demographics && (
          <View>
            <RangeRow label="Age range" min={filters.ageMin ?? 18} max={filters.ageMax ?? 65} absMin={18} absMax={65}
              onChangeMin={(v) => update({ ageMin: v })} onChangeMax={(v) => update({ ageMax: v })} unit="yrs" />
            <RangeRow label="Height range" min={filters.heightMin ?? 140} max={filters.heightMax ?? 210} absMin={140} absMax={210}
              onChangeMin={(v) => update({ heightMin: v })} onChangeMax={(v) => update({ heightMax: v })} unit="cm" />
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Marital status</Text>
            {/* Single-select: the server takes ONE marital status and ignores an array, so a
                second chip used to be silently dropped from the request. Multi-select can
                come back when the endpoint accepts a list. */}
            <ChipGroup idPrefix="marital" options={MARITAL} selected={filters.maritalStatus}
              onToggle={(v) => update({ maritalStatus: filters.maritalStatus?.[0] === v ? [] : [v] })} />
          </View>
        )}

        <Section title="Community" expanded={sections.community} onToggle={() => toggle('community')} />
        {sections.community && (
          <View>
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Religion</Text>
            <ChipGroup idPrefix="religion" options={RELIGIONS.map((r) => ({ label: r, value: r }))} selected={filters.religion ? [filters.religion] : []}
              onToggle={(v) => update({ religion: filters.religion === v ? undefined : v })} />
            {/* No "Exclude gotra": GET /search has no such parameter (SearchScreen drops it), so the
                control implied an exclusion that never happened. Restore it from git history
                when the endpoint honours `excludeGotra`. */}
          </View>
        )}

        <Section title="Career" expanded={sections.career} onToggle={() => toggle('career')} />
        {sections.career && (
          <View>
            {/* No education chips: the server matches `education` by EXACT string while
                profiles store 'Graduate (B.Tech/B.E.)', '12th / Intermediate' and so on, so
                '12th', 'Graduate' and 'PhD' could never match anyone. Return them once the
                endpoint takes a level or a prefix. */}
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Profession</Text>
            <ChipGroup idPrefix="profession" options={PROFESSIONS.map((p) => ({ label: p, value: p }))} selected={filters.profession ? [filters.profession] : []}
              onToggle={(v) => update({ profession: filters.profession === v ? undefined : v })} />
          </View>
        )}

        <Section title="Lifestyle" expanded={sections.lifestyle} onToggle={() => toggle('lifestyle')} />
        {sections.lifestyle && (
          <View>
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Diet</Text>
            <ChipGroup idPrefix="diet" options={DIETS} selected={filters.diet} onToggle={(v) => update({ diet: toggleArray(filters.diet, v) })} />
          </View>
        )}

        <Section title="Cultural" expanded={sections.cultural} onToggle={() => toggle('cultural')} />
        {sections.cultural && (
          <View>
            <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Manglik preference</Text>
            <RadioGroup options={MANGLIK} selected={filters.manglikStatus} onSelect={(v) => update({ manglikStatus: v })} />
            {/* The row is the switch as far as a screen reader is concerned. The visual switch is
                hidden from it and inert (touches fall through to the row), so TalkBack does not
                find a second, unlabelled "switch" inside the labelled one, and one tap is one
                toggle and one haptic. */}
            <PressableScale
              style={[styles.switchRow, elder && { minHeight: tapSize(elder) }]}
              scaleTo={1}
              haptic
              onPress={() => update({ isVerified: !(filters.isVerified ?? false) })}
              accessibilityRole="switch"
              accessibilityLabel="Verified profiles only"
              accessibilityState={{ checked: filters.isVerified ?? false }}
              testID="filter-verified-only"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="subhead" color="fgStrong" style={styles.subLabel}>Verified profiles only</Text>
              <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Switch value={filters.isVerified ?? false} onValueChange={(v) => update({ isVerified: v })} />
              </View>
            </PressableScale>
          </View>
        )}

        </View>
        <View style={styles.bottomPad} />
      </BottomSheetScrollView>

      {/* The footer sits at the bottom edge of a sheet that is anchored to the screen
          bottom, so it owes the home indicator / gesture bar its own inset. */}
      <View
        style={[
          styles.footer,
          { borderTopColor: c.hairline, backgroundColor: c.sheetBg, paddingBottom: spacing.md + insets.bottom },
        ]}
      >
        {onSaveSearch && (
          <Button title="Save search" variant="secondary" icon="bookmark-outline" onPress={onSaveSearch} />
        )}
        <Button
          title={resultCount !== undefined ? `Show ${resultCount} ${resultCount === 1 ? 'profile' : 'profiles'}` : 'Apply'}
          loading={loadingCount}
          onPress={() => { Keyboard.dismiss(); sheetRef.current?.close(); onApply(); }}
        />
      </View>
    </BottomSheet>
  );
});

FilterPanel.displayName = 'FilterPanel';
export default FilterPanel;

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  handle: { width: 38 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.gutter, paddingVertical: spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { flexShrink: 1 },
  resetText: { fontFamily: 'Inter-SemiBold' },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing['2xl'] },
  section: { paddingVertical: spacing.sm },
  subLabel: { marginTop: spacing.sm, marginBottom: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  bottomPad: { height: 80 },
  footer: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.md, borderTopWidth: 0.5, gap: spacing.sm },
});
