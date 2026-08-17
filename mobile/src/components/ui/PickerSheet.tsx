import React from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, type } from '@shared/constants/theme';
import { haptics } from '../../utils/haptics';
import { useTheme } from '../../hooks/useTheme';

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
  const { c } = useTheme();

  const normalized: PickerOption<T | string>[] = options.map((o) =>
    typeof o === 'string' ? { label: o, value: o } : o,
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: insets.bottom }]}>
        <View style={[styles.grabber, { backgroundColor: c.border }]} />
        <Text style={[type.title3, styles.title, { color: c.textPrimary }]}>{title}</Text>
        <FlatList
          data={normalized}
          keyExtractor={(item) => String(item.value)}
          renderItem={({ item }) => {
            const active = item.value === selected;
            return (
              <TouchableOpacity
                style={[styles.row, active && { backgroundColor: c.accentSoft }]}
                onPress={() => {
                  haptics.light();
                  onSelect(item.value);
                  onClose();
                }}
                testID={`option-${item.value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    type.body,
                    { color: active ? c.primary : c.textPrimary },
                    active && styles.rowTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                {active && <Ionicons name="checkmark" size={20} color={c.primary} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '55%',
    paddingTop: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: spacing.md },
  title: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTextActive: { fontFamily: 'Inter-SemiBold' },
});
