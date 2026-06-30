import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn } from 'react-native-reanimated';
import { borderRadius, colours, shadows, type } from '@shared/constants/theme';
import { duration } from '@shared/constants/motion';
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
 * Premium gate — gated content rendered behind a real frosted blur (expo-blur)
 * with a gold lock + unlock CTA that fades in (handoff `dur.base`). The lock
 * overlay fades in over the blurred content per the handoff "premium lock reveal".
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
  const { c, isDark } = useTheme();
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {children ? (
        <View style={styles.content} pointerEvents="none">
          {children}
        </View>
      ) : null}
      {/* real frosted blur over the gated content (handoff blur(9) equivalent) */}
      <BlurView
        intensity={28}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View
        entering={FadeIn.duration(duration.base)}
        style={[styles.overlay, { backgroundColor: c.surfaceCard + '80' }]}
      >
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden', minHeight: 160 },
  content: { transform: [{ scale: 1.04 }] },
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
