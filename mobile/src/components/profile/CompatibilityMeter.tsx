import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

interface Props {
  score: number;
}

// Mirror the web score colouring: green (excellent) / gold (strong) / burgundy.
const scoreColour = (pct: number): string => {
  if (pct >= 90) return colours.success;
  if (pct >= 75) return colours.secondary;
  return colours.primary;
};

export default function CompatibilityMeter({ score }: Props) {
  const clamp = Math.max(0, Math.min(100, score));
  const colour = scoreColour(clamp);
  return (
    <View style={s.container} testID="CompatibilityMeter">
      <View style={s.row}>
        <Text style={s.label}>Compatibility</Text>
        <Text style={[s.pct, { color: colour }]}>{clamp}%</Text>
      </View>
      <View style={s.bar}>
        <View style={[s.fill, { width: `${clamp}%`, backgroundColor: colour }]} />
      </View>
      <Text style={s.hint}>Based on community, lifestyle & preferences</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  pct: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
  },
  bar: {
    height: 8,
    backgroundColor: colours.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },
});
