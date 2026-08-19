import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, Text, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import FastImage from 'react-native-fast-image';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colours, typography, type ThemeColours } from '@shared/constants/theme';
import { CONFIG } from '../../constants/config';

// Resolve a stored photo path into something React Native can load:
// absolute http(s) URLs (real Cloudinary uploads) pass through; relative
// `/uploads/...` paths (legacy/seed) get prefixed with the API host.
const apiHost = (CONFIG.API_URL || '').replace(/\/api\/v1\/?$/, '');
export const resolveImageUri = (uri?: string | null): string | null => {
  const trimmed = uri?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return apiHost + trimmed;
  // Anything else (file://, data:, malformed) can hard-crash Glide via
  // FastImage — fall back to initials rather than risk the native layer.
  if (/^(file|data|content):/.test(trimmed)) return trimmed;
  return null;
};

const AnimatedFastImage = Animated.createAnimatedComponent(FastImage);

interface Props {
  uri?: string | null;
  name?: string;
  style?: StyleProp<ImageStyle>;
  initialSize?: number;
}

// Image with a graceful initials fallback when the photo is missing or fails to
// load (covers photo-less profiles + unresolved seed paths). Backed by
// FastImage for disk/memory caching, with a 200ms fade-in on load so photos
// never pop in harshly.
export default function SmartImage({ uri, name, style, initialSize = 28 }: Props) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const [failed, setFailed] = useState(false);
  const opacity = useSharedValue(0);
  const resolved = resolveImageUri(uri);
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!resolved || failed) {
    return (
      <View style={[style, styles.fallback]}>
        <Text style={[styles.initial, { fontSize: initialSize }]}>{initial}</Text>
      </View>
    );
  }
  return (
    <View style={[style, styles.holder]}>
      <AnimatedFastImage
        source={{ uri: resolved }}
        style={[StyleSheet.absoluteFill, fade]}
        resizeMode={FastImage.resizeMode.cover}
        onLoad={() => {
          opacity.value = withTiming(1, { duration: 200 });
        }}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  holder: {
    backgroundColor: c.p100,
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: c.p100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: c.p700,
    fontFamily: typography.fontFamily.display,
  },
});
