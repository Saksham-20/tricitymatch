import React, { useCallback, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, Text, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import FastImage from 'react-native-fast-image';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { typography, type ThemeColours } from '@shared/constants/theme';
import { duration, EASE_OUT } from '@shared/constants/motion';
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

// A photo that arrives this soon after its load started came out of the native
// memory/disk cache, not the network. It is not a heuristic about animation timing
// (that lives in the token file): it is a cut-off for "was this a cache hit".
const CACHE_HIT_MS = 80;

interface Props {
  uri?: string | null;
  name?: string;
  style?: StyleProp<ImageStyle>;
  initialSize?: number;
  /**
   * Fired once when the photo fails to load (never for a missing uri: the caller
   * already knows that from `resolveImageUri`). Lets a surface that reserved a
   * photo-shaped block swap to its photoless layout instead of showing a big tile.
   */
  onFail?: () => void;
  /**
   * Draw the fallback tile without its big initial. For a caller that lays its own
   * text over the tile (a card's name over a scrim), where the glyph would collide.
   */
  hideInitial?: boolean;
}

// Image with a graceful initials fallback when the photo is missing or fails to
// load (covers photo-less profiles + unresolved seed paths). Backed by
// FastImage for disk/memory caching, with a duration.content fade-in on a real
// (network) load so photos never pop in harshly; a cache hit shows at once,
// because a recycled list row that re-fades a photo it already had reads as reloading.
export default function SmartImage({ uri, name, style, initialSize = 28, onFail, hideInitial = false }: Props) {
  const { c, isDark } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const resolved = resolveImageUri(uri);
  // Which uri failed, not a bare boolean: a row that is handed a different photo
  // (list recycling, a re-upload) gets a fresh chance instead of staying on initials.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = failedUri !== null && failedUri === resolved;
  const opacity = useSharedValue(0);
  const loadStartedAt = useRef<number | null>(null);
  // Per-uri bookkeeping (not a bare "loaded" flag): FastImage can repeat or reorder its
  // load-start / load events, and a later duplicate must not hide a photo that already showed.
  const loadedUri = useRef<string | null>(null);
  const startedUri = useRef<string | null>(null);
  const failReported = useRef<string | null>(null);
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handleLoadStart = useCallback(() => {
    if (loadedUri.current === resolved) return;
    loadStartedAt.current = Date.now();
    // A different photo arriving in a mounted view starts hidden again. Reset on
    // load-START (which always precedes load), never in an effect: an effect can
    // run after a cached photo's load event and wipe the opacity it just set.
    if (startedUri.current !== resolved) {
      startedUri.current = resolved;
      opacity.value = 0;
    }
    // A photo is being (re)tried, so a failure recorded for an earlier uri is stale.
    failReported.current = null;
    setFailedUri((prev) => (prev === null ? prev : null));
  }, [resolved, opacity]);

  const handleLoad = useCallback(() => {
    if (loadedUri.current === resolved) return;
    loadedUri.current = resolved;
    const started = loadStartedAt.current;
    const cacheHit = started !== null && Date.now() - started < CACHE_HIT_MS;
    opacity.value = cacheHit
      ? 1
      : withTiming(1, { duration: duration.content, easing: Easing.bezier(...EASE_OUT) });
  }, [resolved, opacity]);

  const handleError = useCallback(() => {
    if (!resolved || failReported.current === resolved) return;
    failReported.current = resolved;
    setFailedUri(resolved);
    onFail?.();
  }, [resolved, onFail]);

  if (!resolved || failed) {
    return (
      <View style={[style, styles.fallback]}>
        {/* In dark, p100 is the tile and p700 sits about 1.2:1 against it; the light end of the
            scale is the readable one there. maxFontSizeMultiplier: the glyph sits in a fixed circle. */}
        {hideInitial ? null : (
          <Text
            style={[styles.initial, { fontSize: initialSize }, isDark && { color: c.p300 }]}
            maxFontSizeMultiplier={1}
          >{initial}</Text>
        )}
      </View>
    );
  }
  return (
    <View style={[style, styles.holder]}>
      <AnimatedFastImage
        source={{ uri: resolved }}
        style={[StyleSheet.absoluteFill, fade]}
        resizeMode={FastImage.resizeMode.cover}
        onLoadStart={handleLoadStart}
        onLoad={handleLoad}
        onError={handleError}
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
