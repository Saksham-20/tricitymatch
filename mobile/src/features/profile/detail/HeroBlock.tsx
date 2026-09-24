import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text as RNText, View, useWindowDimensions } from 'react-native';
import Text from '../../../components/ui/Text';
import FastImage from 'react-native-fast-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { resolveImageUri } from '../../../components/common/SmartImage';
import { PressableScale, useReduceTransparency } from '../../../components/motion';
import { useTheme } from '../../../hooks/useTheme';
import { tapSize } from '../../../utils/elderTheme';

/** Decorative glyphs sit beside text that already says the same thing. */
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

/** Solid stand-in for the translucent on-photo chip fills (Reduce Transparency). */
const SOLID_CHIP = '#1a1a1a';

/** Visual height of the on-photo chips; `hitSlop` tops each control up to the tap target. */
const GALLERY_CHIP_HEIGHT = 34;

/** Width the gallery chip (top right) and its gutter take, so the photo notice on the left clears it. */
const GALLERY_CHIP_RESERVE = 96;

interface HeroBlockProps {
  photoUri: string | null;
  name: string;
  age: number | null;
  city?: string | null;
  profession?: string | null;
  verified?: boolean;
  compatScore?: number | null;
  height: number;
  /** Distance from the hero's top edge to the gallery chip, so it clears the floating header. */
  chipTop: number;
  /** Total viewable photos — shows the gallery chip when > 0. */
  photoCount?: number;
  /** Open the full-screen gallery viewer. */
  onOpenGallery?: () => void;
}

/**
 * Full-bleed story hero: first photo, bottom scrim, and the identity overlay
 * (Playfair name, city chip, verified badge). A photo-less profile gets a warm
 * burgundy monogram canvas — same overlay, nothing looks broken.
 *
 * The photo is static. Parallax and the overscroll zoom were scroll-scrubbed
 * values that moved the image well past the 16px ceiling; both are banned on
 * RN (doctrine §10.3), and `RevealOnScroll` is the only scroll-driven idiom.
 */
export default function HeroBlock({
  photoUri,
  name,
  age,
  city,
  profession,
  verified,
  compatScore,
  height,
  chipTop,
  photoCount = 0,
  onOpenGallery,
}: HeroBlockProps) {
  const { c, elder } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const s = React.useMemo(() => makeS(c, reduceTransparency), [c, reduceTransparency]);
  const { width } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  // Bumping this remounts the image, which is what makes "Try again" fetch again.
  const [attempt, setAttempt] = useState(0);
  const photoResolved = resolveImageUri(photoUri);
  // A member who HAS a photo must not be shown as photoless: keep the slot, say
  // it did not load, and offer a retry (the gallery still reads "View all N").
  const photoFailed = failed && !!photoResolved;
  const resolved = failed ? null : photoResolved;

  // A different photo is a fresh attempt.
  useEffect(() => {
    setFailed(false);
  }, [photoUri]);

  const onPhotoError = () => {
    setFailed(true);
    // Nothing was tapped, so say what happened.
    AccessibilityInfo.announceForAccessibility("Couldn't load photo");
  };
  const retryPhoto = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const monogram = (name.trim().charAt(0) || '?').toUpperCase();
  const chipSlop = Math.max(0, Math.ceil((tapSize(elder) - GALLERY_CHIP_HEIGHT) / 2));

  return (
    <View style={[s.wrap, { width, height }]}>
      {resolved ? (
        // FastImage takes no accessibility props, so the wrapper carries the alt text.
        <View
          style={StyleSheet.absoluteFill}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Photo of ${name}`}
        >
          <FastImage
            key={attempt}
            source={{ uri: resolved }}
            style={StyleSheet.absoluteFill}
            resizeMode={FastImage.resizeMode.cover}
            onError={onPhotoError}
          />
        </View>
      ) : (
        <View
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <LinearGradient colors={[c.p100, c.p50]} style={StyleSheet.absoluteFill} />
          <View style={s.monogramWrap}>
            {/* Decorative fallback glyph filling the hero canvas — not body copy,
                left on raw RN Text (140px is far outside the canonical scale). */}
            <RNText style={s.monogram} allowFontScaling={false}>{monogram}</RNText>
          </View>
        </View>
      )}

      {/* Bottom scrim so the identity overlay always reads. Photo heroes get a
          neutral black scrim; the monogram fallback keeps a warm burgundy-dark
          one so the pale canvas doesn't turn muddy grey. */}
      <LinearGradient
        colors={
          resolved
            ? ['transparent', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.62)']
            : ['transparent', 'rgba(64,17,35,0.30)', 'rgba(42,11,23,0.72)']
        }
        locations={[0.45, 0.75, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* The photo did not load: cause + a working retry, top left so it clears the
          gallery chip (top right) and the identity overlay below. */}
      {photoFailed && (
        <View
          style={[s.photoError, { top: chipTop, maxWidth: Math.max(160, width - GALLERY_CHIP_RESERVE - spacing.gutter) }]}
          testID="hero-photo-error"
        >
          <View style={s.photoErrorNote}>
            <Ionicons name="image-outline" size={14} color="#fff" {...HIDE_FROM_A11Y} />
            <Text variant="caption" style={s.chipText}>Couldn't load photo</Text>
          </View>
          <PressableScale
            scaleTo={0.92}
            onPress={retryPhoto}
            style={s.retryChip}
            hitSlop={{ top: chipSlop, bottom: chipSlop, left: chipSlop, right: chipSlop }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Try loading the photo again"
            testID="hero-photo-retry-tap44-hitslop"
          >
            <Ionicons name="refresh" size={14} color="#fff" {...HIDE_FROM_A11Y} />
            <Text variant="caption" style={s.galleryChipText} numberOfLines={1}>Try again</Text>
          </PressableScale>
        </View>
      )}

      {/* Gallery chip — all photos, one place. Opening a viewer is navigation,
          not a commit, so no haptic. */}
      {photoCount > 0 && !!onOpenGallery && (
        <PressableScale
          scaleTo={0.92}
          onPress={onOpenGallery}
          style={[s.galleryChip, { top: chipTop }]}
          hitSlop={{ top: chipSlop, bottom: chipSlop, left: chipSlop, right: chipSlop }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={photoCount === 1 ? 'View photo' : `View all ${photoCount} photos`}
          testID="gallery-chip-tap44-hitslop"
        >
          <Ionicons name="images-outline" size={15} color="#fff" {...HIDE_FROM_A11Y} />
          <Text variant="caption" style={s.galleryChipText}>{photoCount}</Text>
        </PressableScale>
      )}

      {/* Identity overlay */}
      <View style={s.overlay} pointerEvents="none">
        <View style={s.nameRow}>
          <Text variant="display" style={s.name} numberOfLines={2} maxScale={1.4} accessibilityRole="header">
            {name}
            {age ? `, ${age}` : ''}
          </Text>
          {verified && (
            <View style={s.verified}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" {...HIDE_FROM_A11Y} />
              <Text variant="micro" style={s.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        <View style={s.metaRow}>
          {!!city && (
            <View style={s.chip}>
              <Ionicons name="location-outline" size={12} color="#fff" {...HIDE_FROM_A11Y} />
              <Text variant="caption" style={s.chipText} numberOfLines={1}>{city}</Text>
            </View>
          )}
          {!!profession && (
            <View style={s.chip}>
              <Ionicons name="briefcase-outline" size={12} color="#fff" {...HIDE_FROM_A11Y} />
              <Text variant="caption" style={s.chipText} numberOfLines={1}>
                {profession}
              </Text>
            </View>
          )}
          {typeof compatScore === 'number' && (
            <View style={[s.chip, s.compatChip]}>
              <Ionicons name="sparkles" size={12} color="#fff" {...HIDE_FROM_A11Y} />
              <Text variant="caption" style={s.chipText} numberOfLines={1}>{compatScore}% match</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const makeS = (c: ThemeColours, solid: boolean) => StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: c.p50 },
  monogramWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monogram: {
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 140,
    color: c.p300,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  nameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  name: {
    color: '#fff',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: solid ? c.success : 'rgba(46,125,50,0.85)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  verifiedText: { color: '#fff' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // A lightening fill (white at 18%) sinks white caption text to about 3:1 over
    // a bright photo; a dark translucent fill holds well above 4.5:1 on any photo.
    backgroundColor: solid ? SOLID_CHIP : 'rgba(0,0,0,0.40)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 220,
  },
  compatChip: { backgroundColor: solid ? c.p500 : 'rgba(139,35,70,0.75)' },
  chipText: { color: '#fff', flexShrink: 1 },
  // The gallery chip and the retry chip sit on the un-scrimmed top of the photo,
  // where white caption text needs a heavier fill than the bottom chips get from
  // the scrim beneath them: 60% black holds 4.5:1 even over a pure-white pixel.
  galleryChip: {
    position: 'absolute',
    right: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: solid ? SOLID_CHIP : 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    minHeight: GALLERY_CHIP_HEIGHT,
  },
  galleryChipText: { color: '#fff' },
  photoError: {
    position: 'absolute',
    left: spacing.gutter,
    alignItems: 'flex-start',
    gap: 6,
  },
  photoErrorNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: solid ? SOLID_CHIP : 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: solid ? SOLID_CHIP : 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    minHeight: GALLERY_CHIP_HEIGHT,
  },
});
