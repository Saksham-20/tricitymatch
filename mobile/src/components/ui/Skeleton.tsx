import React, { useEffect, useState } from 'react';
import { DimensionValue, LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, spacing } from '@shared/constants/theme';
import { duration } from '@shared/constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { useReduceMotion } from '../motion';

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Single shimmering placeholder block — 1.5s left→right sweep (handoff motion
 *  spec), driven on the UI thread. Reduce-motion → static base, no sweep. */
export function SkeletonBlock({ width = '100%', height = 16, radius = borderRadius.sm, style }: SkeletonBlockProps) {
  const { isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (!w || reduceMotion) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1);
    return () => cancelAnimation(x);
  }, [w, reduceMotion, x]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -w + x.value * 2 * w }],
  }));

  const base = isDark ? '#222838' : '#E8E8E8';
  const hi = isDark ? '#2C3346' : '#FBFBFB';
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[{ width, height, borderRadius: radius, backgroundColor: base, overflow: 'hidden' }, style]}
    >
      {w > 0 && !reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
          <LinearGradient
            colors={['transparent', hi, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** List-row placeholder — avatar circle + two text lines. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={54} height={54} radius={borderRadius.pill} />
      <View style={styles.rowText}>
        <SkeletonBlock width="60%" height={14} />
        <SkeletonBlock width="40%" height={12} style={styles.gapTop} />
      </View>
    </View>
  );
}

/** Card placeholder — image block + two text lines. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width="100%" height={160} radius={borderRadius.lg} />
      <SkeletonBlock width="70%" height={16} style={styles.gapTop} />
      <SkeletonBlock width="50%" height={14} style={styles.gapTop} />
    </View>
  );
}

/** Wrap real content so it cross-fades in when it replaces a skeleton
 *  (handoff: skeleton → data over dur.slow). Reduce-motion renders instantly. */
export function SkeletonFade({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  if (reduceMotion) return <View style={style}>{children}</View>;
  return (
    <Animated.View entering={FadeIn.duration(duration.slow)} style={style}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  rowText: { flex: 1 },
  card: { padding: spacing.md },
  gapTop: { marginTop: spacing.sm },
});
