import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import Text from '../ui/Text';

interface Props {
  mobile?: boolean;
  id?: boolean;
  education?: boolean;
  income?: boolean;
}

type BadgeConfig = { label: string; icon: keyof typeof Ionicons.glyphMap; color: string };

const makeBadges = (c: ThemeColours): Record<string, BadgeConfig> => ({
  mobile:    { label: 'Mobile',    icon: 'phone-portrait',  color: c.badgeMobile },
  id:        { label: 'ID',        icon: 'card',            color: c.badgeID },
  education: { label: 'Education', icon: 'school',          color: c.badgeEducation },
  income:    { label: 'Income',    icon: 'cash',            color: c.badgeIncome },
});

export default function VerificationBadges({ mobile, id, education, income }: Props) {
  const { c } = useTheme();
  const BADGES_BY_THEME = React.useMemo(() => makeBadges(c), [c]);
  const earned = [
    mobile    && 'mobile',
    id        && 'id',
    education && 'education',
    income    && 'income',
  ].filter(Boolean) as string[];

  if (earned.length === 0) return null;

  return (
    <View style={s.row} testID="VerificationBadges">
      {earned.map((key) => {
        const cfg = BADGES_BY_THEME[key];
        return (
          <View key={key} style={[s.badge, { backgroundColor: cfg.color + '18' }]}>
            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
            {/* cfg.color is a per-tier badge colour (mobile/id/education/income) — not in the curated text-colour union, left as an override */}
            <Text variant="caption" style={[s.label, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  label: {},
});
