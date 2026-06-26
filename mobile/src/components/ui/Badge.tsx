import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colours, spacing, type } from '@shared/constants/theme';

export type BadgeTone =
  | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
  | 'verified' | 'premium' | 'vip' | 'new';

const toneStyles: Record<Exclude<BadgeTone, 'vip'>, { bg: string; fg: string; border?: string }> = {
  primary:  { bg: colours.accentSoft, fg: colours.accent },
  secondary:{ bg: colours.secondaryLight, fg: colours.textPrimary },
  success:  { bg: colours.successBg, fg: colours.success },
  warning:  { bg: colours.warningBg, fg: colours.warning },
  error:    { bg: colours.errorBg, fg: colours.error },
  info:     { bg: colours.infoBg, fg: colours.info },
  neutral:  { bg: colours.surface2, fg: colours.textSecondary },
  // handoff component library
  verified: { bg: colours.successBg, fg: colours.success, border: 'rgba(46,125,50,0.28)' },
  premium:  { bg: colours.goldSoft, fg: colours.g600, border: 'rgba(201,162,39,0.35)' },
  new:      { bg: colours.accent, fg: '#fff' },
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Small tinted status pill — verification, premium/VIP, plan tags, doc statuses. */
export function Badge({ label, tone = 'neutral', icon, style, testID }: BadgeProps) {
  // VIP = gold gradient fill (the one place gold fills, per the handoff)
  if (tone === 'vip') {
    return (
      <LinearGradient
        colors={[colours.g400, colours.g600]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, style]}
        testID={testID}
      >
        {icon}
        <Text style={[styles.badgeText, { color: colours.goldText }]} numberOfLines={1}>{label}</Text>
      </LinearGradient>
    );
  }
  const t = toneStyles[tone];
  return (
    <View
      style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border ?? 'transparent' }, style]}
      testID={testID}
    >
      {icon}
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}

/** Selectable filter/tag pill — outline by default, accent-tinted when selected. */
export function Chip({ label, selected = false, icon, onPress, testID }: ChipProps) {
  const Container: React.ElementType = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      testID={testID}
      activeOpacity={0.8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
    >
      {icon}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    ...type.caption,
    fontFamily: 'Inter-Bold',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.surface2,
  },
  chipSelected: {
    backgroundColor: colours.accentSoft,
    borderColor: 'rgba(139,35,70,0.4)',
  },
  chipText: {
    ...type.subhead,
    color: colours.textPrimary,
  },
  chipTextSelected: {
    color: colours.accent,
    fontFamily: 'Inter-SemiBold',
  },
});
