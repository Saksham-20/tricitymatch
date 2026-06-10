import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { borderRadius, colours, spacing, typography } from '@shared/constants/theme';

export type BadgeTone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

const toneStyles: Record<BadgeTone, { bg: string; fg: string }> = {
  primary: { bg: colours.primaryLight, fg: colours.primary },
  secondary: { bg: colours.secondaryLight, fg: colours.textPrimary },
  success: { bg: colours.successBg, fg: colours.success },
  warning: { bg: colours.warningBg, fg: colours.warning },
  error: { bg: colours.errorBg, fg: colours.error },
  info: { bg: colours.infoBg, fg: colours.info },
  neutral: { bg: colours.border, fg: colours.textSecondary },
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Small tinted status pill — verification badges, plan tags, doc statuses. */
export function Badge({ label, tone = 'neutral', icon, style, testID }: BadgeProps) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]} testID={testID}>
      {icon}
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

/** Selectable filter/tag pill — outline by default, tinted when selected. */
export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  const Container: React.ElementType = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: typography.fontSize['2xs'],
    fontFamily: typography.fontFamily.semiBold,
    letterSpacing: 0.4,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.surfaceCard,
  },
  chipSelected: {
    backgroundColor: colours.primaryLight,
    borderColor: colours.primary,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
  },
  chipTextSelected: {
    color: colours.primary,
  },
});
