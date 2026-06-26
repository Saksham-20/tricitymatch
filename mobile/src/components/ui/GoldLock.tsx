import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colours, shadows, type } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import Button from './Button';

interface GoldLockProps {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onUnlock?: () => void;
  /** the gated content rendered (dimmed) behind the lock overlay */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Premium gate — renders gated content dimmed behind a gold lock + unlock CTA.
 * (True blur needs expo-blur/native; we use a scrim + low-opacity content so it
 * works in Expo Go and stale dev clients.)
 */
export default function GoldLock({
  title,
  subtitle,
  ctaLabel = 'Unlock with Premium',
  onUnlock,
  children,
  style,
  testID,
}: GoldLockProps) {
  const { c } = useTheme();
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {children ? (
        <View style={styles.dimmed} pointerEvents="none">
          {children}
        </View>
      ) : null}
      <View style={[styles.overlay, { backgroundColor: c.surfaceCard + 'D9' }]}>
        <LinearGradient
          colors={[colours.g300, colours.g500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.lock}
        >
          <Ionicons name="lock-closed" size={22} color={colours.goldText} />
        </LinearGradient>
        <Text style={[styles.title, { color: c.fgStrong }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text> : null}
        {onUnlock ? (
          <Button title={ctaLabel} variant="gold" size="sm" icon="sparkles" onPress={onUnlock} style={styles.cta} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden', minHeight: 160 },
  dimmed: { opacity: 0.25 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  lock: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.gold,
  },
  title: { ...type.headline, textAlign: 'center' },
  subtitle: { ...type.footnote, textAlign: 'center', maxWidth: 240 },
  cta: { marginTop: 6, minWidth: 200 },
});
