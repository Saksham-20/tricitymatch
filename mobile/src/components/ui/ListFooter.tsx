import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, type } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ListFooterProps {
  /** loading = fetching next page · end = no more items · idle = nothing */
  state: 'loading' | 'end' | 'idle';
  endText?: string;
}

/** Unified infinite-scroll footer — the ONLY sanctioned in-list spinner. */
export default function ListFooter({ state, endText = "You're all caught up" }: ListFooterProps) {
  const { c } = useTheme();
  if (state === 'idle') return null;
  return (
    <View style={styles.wrap}>
      {state === 'loading' ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : (
        <Text style={[type.footnote, { color: c.textMuted }]}>{endText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.xl, alignItems: 'center' },
});
