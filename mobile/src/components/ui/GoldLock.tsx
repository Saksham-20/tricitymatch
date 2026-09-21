import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn } from 'react-native-reanimated';
import { borderRadius, colours, shadows, darkShadows } from '@shared/constants/theme';
import { duration } from '@shared/constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { useReduceTransparency } from '../motion';
import Button from './Button';
import Text from './Text';

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
  const reduceTransparency = useReduceTransparency();
  // With no gated content behind it the wrap has nothing to size it, so an
  // absolutely-positioned overlay is measured against `minHeight` alone and the
  // CTA is clipped by `overflow: hidden`. Let the overlay sit in flow instead
  // and the wrap grows to fit it.
  const bare = !children;
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {children ? (
        <View style={styles.content} pointerEvents="none">
          {children}
        </View>
      ) : null}
      {/* real frosted blur over the gated content (handoff blur(9) equivalent);
          Reduce Transparency swaps it for an opaque tint (doctrine §10.5). */}
      {reduceTransparency ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.surfaceCard }]}
          pointerEvents="none"
        />
      ) : (
        <BlurView
          intensity={28}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <Animated.View
        // duration.reveal is reserved for Operate-surface scroll reveals
        // (doctrine §10.3) — this is a one-time content entrance instead.
        entering={FadeIn.duration(duration.content)}
        style={[
          bare ? styles.overlayFlow : styles.overlay,
          { backgroundColor: c.surfaceCard + '80' },
        ]}
      >
        <LinearGradient
          colors={[colours.g300, colours.g500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.lock, isDark ? darkShadows.gold : shadows.gold]}
        >
          <Ionicons name="lock-closed" size={22} color={colours.goldText} />
        </LinearGradient>
        <Text variant="headline" color="fgStrong" style={styles.title}>{title}</Text>
        {subtitle ? <Text variant="footnote" color="textMuted" style={styles.subtitle}>{subtitle}</Text> : null}
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
  // same box, in flow — used when there is no gated content to overlay
  overlayFlow: {
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
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', maxWidth: 240 },
  cta: { marginTop: 6, minWidth: 200 },
});
