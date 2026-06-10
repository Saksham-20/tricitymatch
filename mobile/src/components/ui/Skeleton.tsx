import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { borderRadius, cream, spacing } from '@shared/constants/theme';

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

function useShimmer() {
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

/** Single shimmering placeholder block. */
export function SkeletonBlock({ width = '100%', height = 16, radius = borderRadius.sm, style }: SkeletonBlockProps) {
  const opacity = useShimmer();
  return (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: cream[200], opacity }, style]} />
  );
}

/** List-row placeholder — avatar circle + two text lines. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={48} height={48} radius={borderRadius.full} />
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
