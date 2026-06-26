import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import { colours, typography } from '@shared/constants/theme';
import { CONFIG } from '../../constants/config';

// Resolve a stored photo path into something React Native can load:
// absolute http(s) URLs (real Cloudinary uploads) pass through; relative
// `/uploads/...` paths (legacy/seed) get prefixed with the API host.
const apiHost = (CONFIG.API_URL || '').replace(/\/api\/v1\/?$/, '');
export const resolveImageUri = (uri?: string | null): string | null => {
  if (!uri) return null;
  if (/^https?:\/\//.test(uri)) return uri;
  if (uri.startsWith('/')) return apiHost + uri;
  return uri;
};

interface Props {
  uri?: string | null;
  name?: string;
  style?: StyleProp<ImageStyle>;
  initialSize?: number;
}

// Image with a graceful initials fallback when the photo is missing or fails to load
// (covers photo-less profiles + unresolved seed paths) — no more blank grey boxes.
export default function SmartImage({ uri, name, style, initialSize = 28 }: Props) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUri(uri);
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();

  if (!resolved || failed) {
    return (
      <View style={[style, styles.fallback]}>
        <Text style={[styles.initial, { fontSize: initialSize }]}>{initial}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: resolved }}
      style={style}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colours.p100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: colours.p700,
    fontFamily: typography.fontFamily.display,
  },
});
