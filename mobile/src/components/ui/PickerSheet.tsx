import React, { useRef } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import Text from './Text';
import { PressableScale, useReduceMotion, useReduceTransparency } from '../motion';
import { tapSize } from '../../utils/elderTheme';
import { LIST_PERF } from '../../constants/listPerf';

export interface PickerOption<T> {
  label: string;
  value: T;
}

interface PickerSheetProps<T> {
  visible: boolean;
  title: string;
  /** Plain strings or {label, value} pairs. */
  options: ReadonlyArray<string | PickerOption<T>>;
  /** Compared by === against each option's value; null/undefined = none selected. */
  selected: unknown;
  onSelect: (value: T | string) => void;
  onClose: () => void;
}

/**
 * Single-select bottom sheet used across onboarding + forms. Rows use opacity
 * press (iOS list convention — rows don't scale); selection gets burgundy text
 * + a right-aligned checkmark and a light haptic.
 */
export default function PickerSheet<T = string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: PickerSheetProps<T>) {
  const insets = useSafeAreaInsets();
  const { c, elder } = useTheme();
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();
  const listRef = useRef<FlatList<PickerOption<T | string>>>(null);

  const normalized: PickerOption<T | string>[] = options.map((o) =>
    typeof o === 'string' ? { label: o, value: o } : o,
  );

  // A long list (the age picker has ~48 rows) must open on the current value, not row 1.
  // Driven by the list's own layout (it mounts fresh each time the sheet opens), not a timer.
  const selectedIndex = normalized.findIndex((o) => o.value === selected);
  const rowHeight = Math.max(52, tapSize(elder));
  const scrollToSelected = () => {
    if (selectedIndex < 1) return;
    listRef.current?.scrollToIndex({ index: selectedIndex, animated: false, viewPosition: 0.4 });
  };

  return (
    <Modal visible={visible} animationType={reduceMotion ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <PressableScale
        style={[styles.backdrop, reduceTransparency && styles.backdropSolid]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      />
      <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: insets.bottom }]}>
        <Text variant="title3" color="textPrimary" style={styles.title}>{title}</Text>
        {/* No grabber: this sheet does not drag, so a handle would promise a gesture it lacks. */}
        <FlatList
          ref={listRef}
          {...LIST_PERF}
          onLayout={scrollToSelected}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Rows past the first window are unmeasured: jump by an estimate, then settle.
            listRef.current?.scrollToOffset({ offset: index * (averageItemLength || rowHeight), animated: false });
            setTimeout(scrollToSelected, 50);
          }}
          data={normalized}
          keyExtractor={(item) => String(item.value)}
          renderItem={({ item }) => {
            const active = item.value === selected;
            return (
              <PressableScale
                style={[styles.row, { minHeight: rowHeight }, active && { backgroundColor: c.accentSoft }]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                haptic
                testID={`option-${item.value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant={active ? 'headline' : 'body'} color={active ? 'primary' : 'textPrimary'}>
                  {item.label}
                </Text>
                {active && <Ionicons name="checkmark" size={20} color={c.primary} />}
              </PressableScale>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  backdropSolid: { backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '55%',
    paddingTop: spacing.sm,
  },
  title: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
