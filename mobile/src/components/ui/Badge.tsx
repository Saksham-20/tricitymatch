import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, spacing, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../motion';
import Text from './Text';

export type BadgeTone =
  | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
  | 'verified' | 'premium' | 'vip' | 'new';

const makeToneStyles = (c: ThemeColours): Record<Exclude<BadgeTone, 'vip'>, { bg: string; fg: string; border?: string }> => ({
  primary:  { bg: c.accentSoft, fg: c.accent },
  secondary:{ bg: c.secondaryLight, fg: c.textPrimary },
  success:  { bg: c.successBg, fg: c.success },
  warning:  { bg: c.warningBg, fg: c.warning },
  error:    { bg: c.errorBg, fg: c.error },
  info:     { bg: c.infoBg, fg: c.info },
  neutral:  { bg: c.surface2, fg: c.textSecondary },
  // handoff component library
  verified: { bg: c.successBg, fg: c.success, border: 'rgba(46,125,50,0.28)' },
  // Gold is the fill and the border, never the label (doctrine 10.8): g600 on goldSoft is 2.7:1 in
  // light. textPrimary clears 12:1 on the light fill and 13:1 on the dark one (goldText is a dark
  // brown that only works on the light fill), so one token reads in both themes.
  premium:  { bg: c.goldSoft, fg: c.textPrimary, border: 'rgba(201,162,39,0.35)' },
  new:      { bg: c.accent, fg: '#fff' },
});

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Small tinted status pill — verification, premium/VIP, plan tags, doc statuses. */
export function Badge({ label, tone = 'neutral', icon, style, testID }: BadgeProps) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const toneStylesByTheme = React.useMemo(() => makeToneStyles(c), [c]);
  // VIP = gold gradient fill (the one place gold fills, per the handoff)
  if (tone === 'vip') {
    return (
      <LinearGradient
        colors={[c.g400, c.g600]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, style]}
        testID={testID}
      >
        {icon}
        {/* c.goldText is a gold token, excluded from the curated text-colour union — kept as a style override */}
        <Text variant="caption" style={[styles.badgeText, { color: c.goldText }]} numberOfLines={1}>{label}</Text>
      </LinearGradient>
    );
  }
  const t = toneStylesByTheme[tone];
  return (
    <View
      style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border ?? 'transparent' }, style]}
      testID={testID}
    >
      {icon}
      {/* t.fg spans curated AND non-curated colours (e.g. warning's orange) depending on `tone` at runtime — left as a style override */}
      <Text variant="caption" style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>{label}</Text>
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
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const Container: React.ElementType = onPress ? PressableScale : View;
  return (
    <Container
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
    >
      {icon}
      {/* c.accent is the 'primary' alias (identical hex) */}
      <Text variant="subhead" color={selected ? 'primary' : 'textPrimary'} style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Container>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
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
    borderColor: c.border,
    backgroundColor: c.surface2,
  },
  chipSelected: {
    backgroundColor: c.accentSoft,
    borderColor: 'rgba(139,35,70,0.4)',
  },
  chipText: {},
  chipTextSelected: {
    fontFamily: 'Inter-SemiBold',
  },
});
