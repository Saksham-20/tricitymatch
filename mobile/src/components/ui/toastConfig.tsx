import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { colours, darkColours, type, borderRadius, spacing, shadows } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

type Tone = 'success' | 'error' | 'info';

const TONE: Record<Tone, { icon: keyof typeof Ionicons.glyphMap; light: string; dark: string }> = {
  success: { icon: 'checkmark-circle', light: colours.success, dark: '#4CAF7D' },
  error:   { icon: 'alert-circle',     light: colours.error,   dark: '#E57373' },
  info:    { icon: 'information-circle', light: colours.primary, dark: darkColours.primary },
};

function BrandToast({ text1, text2, tone }: ToastConfigParams<unknown> & { tone: Tone }) {
  const { isDark } = useTheme();
  const accent = isDark ? TONE[tone].dark : TONE[tone].light;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? darkColours.surfaceCard : colours.surfaceCard,
          borderColor: isDark ? darkColours.border : colours.border,
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <Ionicons name={TONE[tone].icon} size={22} color={accent} style={styles.icon} />
      <View style={styles.textWrap}>
        {!!text1 && (
          <Text
            style={[type.subhead, { color: isDark ? darkColours.textPrimary : colours.textPrimary }]}
            numberOfLines={2}
          >
            {text1}
          </Text>
        )}
        {!!text2 && (
          <Text
            style={[type.footnote, styles.body, { color: isDark ? darkColours.textSecondary : colours.textSecondary }]}
            numberOfLines={3}
          >
            {text2}
          </Text>
        )}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: (p) => <BrandToast {...p} tone="success" />,
  error:   (p) => <BrandToast {...p} tone="error" />,
  info:    (p) => <BrandToast {...p} tone="info" />,
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '92%',
    minHeight: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingRight: spacing.lg,
    overflow: 'hidden',
    ...shadows.e3,
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  icon: { marginLeft: spacing.lg, marginRight: spacing.md },
  textWrap: { flex: 1 },
  body: { marginTop: 2 },
});
