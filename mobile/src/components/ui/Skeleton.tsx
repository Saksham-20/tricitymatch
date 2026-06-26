import React, { useEffect, useRef, useState } from 'react';
import { Animated, DimensionValue, LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, spacing } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Single shimmering placeholder block — 1.5s left→right sweep (handoff motion spec). */
export function SkeletonBlock({ width = '100%', height = 16, radius = borderRadius.sm, style }: SkeletonBlockProps) {
  const { isDark } = useTheme();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!w) return;
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1500, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [w, x]);

  const base = isDark ? '#222838' : '#E8E8E8';
  const hi = isDark ? '#2C3346' : '#FBFBFB';
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });

  return (
    <View
      onLayout={onLayout}
      style={[{ width, height, borderRadius: radius, backgroundColor: base, overflow: 'hidden' }, style]}
    >
      {w > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  rowText: { flex: 1 },
  card: { padding: spacing.md },
  gapTop: { marginTop: spacing.sm },
});
