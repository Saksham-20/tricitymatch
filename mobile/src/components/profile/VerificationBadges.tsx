import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

interface Props {
  mobile?: boolean;
  id?: boolean;
  education?: boolean;
  income?: boolean;
}

type BadgeConfig = { label: string; icon: keyof typeof Ionicons.glyphMap; color: string };

const BADGES: Record<string, BadgeConfig> = {
  mobile:    { label: 'Mobile',    icon: 'phone-portrait',  color: colours.badgeMobile },
  id:        { label: 'ID',        icon: 'card',            color: colours.badgeID },
  education: { label: 'Education', icon: 'school',          color: colours.badgeEducation },
  income:    { label: 'Income',    icon: 'cash',            color: colours.badgeIncome },
};

export default function VerificationBadges({ mobile, id, education, income }: Props) {
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
        const cfg = BADGES[key];
        return (
          <View key={key} style={[s.badge, { backgroundColor: cfg.color + '18' }]}>
            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
            <Text style={[s.label, { color: cfg.color }]}>{cfg.label} ✓</Text>
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
  label: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
});
