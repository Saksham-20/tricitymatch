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
 * (Playfair name, city chip, verified badge).
 *
 * With no photo on screen the hero is a light monogram canvas and the identity
 * reads dark-on-light (`fgStrong` name, `surface2` chips): there is no photo for
 * a scrim to protect the text from, and a dark scrim over a pale canvas only
 * produced a muddy pink-to-brown ramp with a white name at about 4:1.
 *   bare    the member has no resolvable photo at all. A compact, in-flow hero
 *           (the screen passes a short `height`, used as a minimum) with a
 *           smaller monogram: it holds nothing worth 56% of the screen.
 *   failed  a photo exists but did not load. Keeps the full-height slot, says so,
 *           and offers a retry, so a member with a photo is never shown as
 *           photoless.
 * The hero carries no compatibility chip: the compatibility card leads the page
 * one block below, so the same number was shown twice.
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
  height,
  chipTop,
  photoCount = 0,
  onOpenGallery,
}: HeroBlockProps) {
  const { c, elder } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const { width } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  // Bumping this remounts the image, which is what makes "Try again" fetch again.
  const [attempt, setAttempt] = useState(0);
  const photoResolved = resolveImageUri(photoUri);
  // A member who HAS a photo must not be shown as photoless: keep the slot, say
  // it did not load, and offer a retry (the gallery still reads "View all N").
  const photoFailed = failed && !!photoResolved;
  const resolved = failed ? null : photoResolved;
  // No photo on screen (never had one, or it failed): light canvas, dark-on-light identity.
  const light = !resolved;
  const bare = !photoResolved;
  const s = React.useMemo(() => makeS(c, reduceTransparency, light), [c, reduceTransparency, light]);

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

  const galleryChip =
    photoCount > 0 && !!onOpenGallery ? (
      // Gallery chip — all photos, one place. Opening a viewer is navigation,
      // not a commit, so no haptic.
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
    ) : null;

  // The photo did not load: cause + a working retry, top left so it clears the
  // gallery chip (top right) and the identity block below.
  const photoErrorBlock = photoFailed ? (
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
  ) : null;

  const chipIcon = light ? c.textSecondary : '#fff';
  const identity = (
    <>
      <View style={s.nameRow}>
        <Text
          variant="display"
          color={light ? 'fgStrong' : undefined}
          style={s.name}
          numberOfLines={2}
          maxScale={1.4}
          accessibilityRole="header"
        >
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
            <Ionicons name="location-outline" size={12} color={chipIcon} {...HIDE_FROM_A11Y} />
            <Text variant="caption" color={light ? 'textPrimary' : undefined} style={s.chipLabel} numberOfLines={1}>{city}</Text>
          </View>
        )}
        {!!profession && (
          <View style={s.chip}>
            <Ionicons name="briefcase-outline" size={12} color={chipIcon} {...HIDE_FROM_A11Y} />
            <Text variant="caption" color={light ? 'textPrimary' : undefined} style={s.chipLabel} numberOfLines={1}>
              {profession}
            </Text>
          </View>
        )}
      </View>
    </>
  );

  if (bare) {
    // Compact and in flow: `height` is a floor, so a two-line display name grows the hero instead of
    // sliding under the monogram. flexGrow (not flex: 1), or an auto-height parent measures the body as 0.
    return (
      <View style={[s.wrap, { width, minHeight: height }]}>
        <View
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <LinearGradient colors={[c.p100, c.p50]} style={StyleSheet.absoluteFill} />
        </View>
        <View style={[s.bareBody, { paddingTop: chipTop }]}>
          <View
            style={s.bareMonogramWrap}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {/* Decorative fallback glyph, not body copy: left on raw RN Text (96px is outside the canonical scale). */}
            <RNText style={s.monogramBare} allowFontScaling={false}>{monogram}</RNText>
          </View>
          <View style={s.identityFlow}>{identity}</View>
        </View>
        {galleryChip}
      </View>
    );
  }

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

      {/* Bottom scrim, photo heroes only: it is what keeps the white identity readable over an
          arbitrary photograph. A canvas with no photo has nothing to defend the text from. */}
      {resolved && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.62)']}
          locations={[0.45, 0.75, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {photoErrorBlock}
      {galleryChip}

      {/* Identity overlay */}
      <View style={s.overlay} pointerEvents="none">
        {identity}
      </View>
    </View>
  );
}

const makeS = (c: ThemeColours, solid: boolean, light: boolean) => StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: c.p50 },
  monogramWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monogram: {
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 140,
    color: c.p300,
  },
  // The compact hero: a column with the monogram taking whatever the identity block leaves.
  bareBody: { flexGrow: 1 },
  bareMonogramWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  monogramBare: {
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 96,
    lineHeight: 108,
    includeFontPadding: false,
    color: c.p300,
  },
  identityFlow: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
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
  // On a photo the name is white with a soft shadow; on the light canvas the `Text` colour
  // (`fgStrong`) applies and there is no shadow to lift it.
  name: light
    ? { flexShrink: 1 }
    : {
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
    // Solid on the light canvas: a translucent green washes out over a pale ground and white text
    // on it falls under 4.5:1.
    backgroundColor: solid || light ? c.success : 'rgba(46,125,50,0.85)',
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
    backgroundColor: light ? c.surface2 : solid ? SOLID_CHIP : 'rgba(0,0,0,0.40)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 220,
  },
  // The on-photo error note is always white-on-dark; the identity chips are white only over a photo
  // and take the `Text` colour (`textPrimary`) on the light canvas.
  chipText: { color: '#fff', flexShrink: 1 },
  chipLabel: light ? { flexShrink: 1 } : { color: '#fff', flexShrink: 1 },
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
