import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, type, borderRadius, shadows } from '@shared/constants/theme';
import { useTheme } from '../../../hooks/useTheme';

interface SectionCardProps {
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Soft accent wash background (family/values warmth) instead of plain card. */
  tinted?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Flat editorial content card — the story scroll's standard container. */
export default function SectionCard({ title, icon, tinted = false, children, style }: SectionCardProps) {
  const { c, isDark } = useTheme();
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: tinted ? c.accentSoft : c.surfaceCard,
          borderColor: tinted ? 'transparent' : c.border,
        },
        !isDark && !tinted && shadows.e1,
        style,
      ]}
    >
      {!!title && (
        <View style={s.titleRow}>
          {!!icon && <Ionicons name={icon} size={16} color={c.primary} />}
          <Text style={[s.title, { color: c.fgStrong }]}>{title}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  title: { ...type.title3, fontFamily: 'PlayfairDisplay-Bold', fontSize: 19 },
});
