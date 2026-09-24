import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Text from '../../../components/ui/Text';
import Card from '../../../components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@shared/constants/theme';
import { useTheme } from '../../../hooks/useTheme';

interface SectionCardProps {
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Soft accent wash background (family/values warmth) instead of plain card. */
  tinted?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// A tinted card is a flat wash: it takes no elevation at all (§10.8, one
// elevation cue per element).
const FLAT: ViewStyle = { shadowOpacity: 0, elevation: 0 };

/**
 * The story scroll's standard container. Built on the shared `Card`, so the
 * elevation is declared once (shadow, theme-aware) rather than a border and a
 * shadow stacked on the same element.
 */
export default function SectionCard({ title, icon, tinted = false, children, style }: SectionCardProps) {
  const { c } = useTheme();
  return (
    <Card style={[s.card, tinted && { backgroundColor: c.accentSoft }, tinted && FLAT, style]}>
      {!!title && (
        <View style={s.titleRow}>
          {!!icon && (
            <Ionicons
              name={icon}
              size={16}
              color={c.primary}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          )}
          <Text variant="title2" color="fgStrong" accessibilityRole="header" style={s.title}>
            {title}
          </Text>
        </View>
      )}
      {children}
    </Card>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.xl,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  title: { flexShrink: 1 },
});
