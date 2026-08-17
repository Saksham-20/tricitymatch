import React, { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import FastImage from 'react-native-fast-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SharedValue, interpolate, useAnimatedStyle, Extrapolation } from 'react-native-reanimated';
import { colours, spacing, type, borderRadius } from '@shared/constants/theme';
import { resolveImageUri } from '../../../components/common/SmartImage';
import { PressableScale, useReduceMotion } from '../../../components/motion';

const AnimatedFastImage = Animated.createAnimatedComponent(FastImage);

interface HeroBlockProps {
  photoUri: string | null;
  name: string;
  age: number | null;
  city?: string | null;
  profession?: string | null;
  verified?: boolean;
  compatScore?: number | null;
  scrollY: SharedValue<number>;
  height: number;
  /** Total viewable photos — shows the gallery chip when > 0. */
  photoCount?: number;
  /** Open the full-screen gallery viewer. */
  onOpenGallery?: () => void;
}

/**
 * Full-bleed story hero: first photo with parallax + overscroll zoom, bottom
 * scrim, and the identity overlay (Playfair name, city chip, verified badge).
 * A photo-less profile gets a warm burgundy monogram canvas — same overlay,
 * nothing looks broken.
 */
export default function HeroBlock({
  photoUri,
  name,
  age,
  city,
  profession,
  verified,
  compatScore,
  scrollY,
  height,
  photoCount = 0,
  onOpenGallery,
}: HeroBlockProps) {
  const { width } = useWindowDimensions();
  const reduced = useReduceMotion();
  const [failed, setFailed] = useState(false);
  const resolved = failed ? null : resolveImageUri(photoUri);

  // Parallax: hero moves at half scroll speed; overscroll (pull down) zooms.
  const imgStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-height, 0, height],
            [-height / 2, 0, height * 0.4],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(scrollY.value, [-height, 0], [1.6, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const monogram = (name.trim().charAt(0) || '?').toUpperCase();

  return (
    <View style={[s.wrap, { width, height }]}>
      {resolved ? (
        <AnimatedFastImage
          source={{ uri: resolved }}
          style={[StyleSheet.absoluteFill, imgStyle]}
          resizeMode={FastImage.resizeMode.cover}
          onError={() => setFailed(true)}
        />
      ) : (
        <Animated.View style={[StyleSheet.absoluteFill, imgStyle]}>
          <LinearGradient colors={[colours.p100, colours.p50]} style={StyleSheet.absoluteFill} />
          <View style={s.monogramWrap}>
            <Text style={s.monogram}>{monogram}</Text>
          </View>
        </Animated.View>
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

      {/* Gallery chip — all photos, one place */}
      {photoCount > 0 && !!onOpenGallery && (
        <PressableScale
          scaleTo={0.92}
          haptic
          onPress={onOpenGallery}
          style={[s.galleryChip, { top: 116 }]}
          accessibilityRole="button"
          accessibilityLabel={`View all ${photoCount} photos`}
          testID="gallery-chip"
        >
          <Ionicons name="images-outline" size={15} color="#fff" />
          <Text style={s.galleryChipText}>{photoCount}</Text>
        </PressableScale>
      )}

      {/* Identity overlay */}
      <View style={s.overlay} pointerEvents="none">
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={2}>
            {name}
            {age ? `, ${age}` : ''}
          </Text>
          {verified && (
            <View style={s.verified}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={s.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        <View style={s.metaRow}>
          {!!city && (
            <View style={s.chip}>
              <Ionicons name="location-outline" size={12} color="#fff" />
              <Text style={s.chipText}>{city}</Text>
            </View>
          )}
          {!!profession && (
            <View style={s.chip}>
              <Ionicons name="briefcase-outline" size={12} color="#fff" />
              <Text style={s.chipText} numberOfLines={1}>
                {profession}
              </Text>
            </View>
          )}
          {typeof compatScore === 'number' && (
            <View style={[s.chip, s.compatChip]}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={s.chipText}>{compatScore}% match</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colours.p50 },
  monogramWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monogram: {
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 140,
    color: colours.p300,
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
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 32,
    lineHeight: 38,
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
    backgroundColor: 'rgba(46,125,50,0.85)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  verifiedText: { ...type.micro, color: '#fff' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 220,
  },
  compatChip: { backgroundColor: 'rgba(139,35,70,0.75)' },
  chipText: { ...type.caption, color: '#fff' },
  galleryChip: {
    position: 'absolute',
    right: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    height: 34,
  },
  galleryChipText: { ...type.caption, color: '#fff' },
});
