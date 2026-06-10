import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colours, spacing, typography } from '@shared/constants/theme';

interface SectionHeaderProps {
  /** Short uppercase kicker, e.g. "WHY THIS MATCH" — rendered with editorial letter-spacing */
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Editorial section divider — gold eyebrow label + serif title, used to break up screen content. */
export default function SectionHeader({ eyebrow, title, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textGroup}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  textGroup: { flex: 1 },
  eyebrow: {
    fontSize: typography.fontSize['2xs'],
    fontFamily: typography.fontFamily.semiBold,
    color: colours.secondary,
    letterSpacing: typography.letterSpacing.eyebrow,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.display,
    color: colours.textPrimary,
  },
});
