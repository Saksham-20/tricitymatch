import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import FastImage from 'react-native-fast-image';
import { Ionicons } from '@expo/vector-icons';
import { colours, spacing, type, borderRadius } from '@shared/constants/theme';
import { resolveImageUri } from '../../../components/common/SmartImage';
import { useTheme } from '../../../hooks/useTheme';

interface PhotoBlockProps {
  uri: string;
  /** Warm matrimonial caption shown in the band beneath the photo. */
  caption?: string;
  /** Small eyebrow above the caption, e.g. the person's first name. */
  eyebrow?: string;
  /** Premium gate: blur + lock overlay for non-premium viewers. */
  locked?: boolean;
  /** Tap to open the full-screen gallery viewer (unlocked photos only). */
  onPress?: () => void;
}

/**
 * Full-width 4:5 photo woven into the story scroll, with a caption band —
 * the photo carries a line of warmth instead of floating context-free
 * (interleaved-content pattern; matrimonial voice, never flirty).
 * A photo that fails to load renders nothing — the story simply flows on.
 */
export default function PhotoBlock({ uri, caption, eyebrow, locked = false, onPress }: PhotoBlockProps) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUri(uri);
  if (!resolved || failed) return null;

  const photoW = width - spacing.gutter * 2;
  const photoH = Math.round((photoW * 5) / 4);

  return (
    <View style={s.wrap}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'imagebutton' : 'image'}
        accessibilityLabel={caption ?? 'Profile photo'}
        style={[s.photoHolder, { width: photoW, height: photoH, backgroundColor: c.surface2 }]}
      >
        <FastImage
          source={{ uri: resolved }}
          style={StyleSheet.absoluteFill}
          resizeMode={FastImage.resizeMode.cover}
          onError={() => setFailed(true)}
        />
        {locked && (
          <View style={s.lockOverlay}>
            <View style={s.lockBadge}>
              <Ionicons name="lock-closed" size={22} color="#fff" />
              <Text style={s.lockText}>Upgrade to view</Text>
            </View>
          </View>
        )}
      </Pressable>
      {!!caption && !locked && (
        <View style={s.captionBand}>
          {!!eyebrow && <Text style={[s.eyebrow, { color: c.primary }]}>{eyebrow}</Text>}
          <Text style={[s.caption, { color: c.textSecondary }]}>{caption}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.gutter, marginTop: spacing.xl },
  photoHolder: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,26,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: { alignItems: 'center', gap: 6 },
  lockText: { ...type.subhead, color: '#fff' },
  captionBand: {
    paddingTop: spacing.sm,
    paddingHorizontal: 2,
  },
  eyebrow: {
    ...type.micro,
    color: colours.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  caption: {
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 16,
    lineHeight: 22,
    color: colours.textSecondary,
  },
});
