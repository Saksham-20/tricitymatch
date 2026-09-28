import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Text from '../ui/Text';
import Avatar from '../ui/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { spacing, borderRadius, shadows, darkShadows, type ThemeColours } from '@shared/constants/theme';
import { duration, EASE_OUT } from '@shared/constants/motion';
import type { ProfileSummary } from '../../types';
import SmartImage, { resolveImageUri } from '../common/SmartImage';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import { getAge } from '../../utils/dateUtils';
import { tapSize } from '../../utils/elderTheme';
import { PressableScale, usePop, useReduceMotion, useReduceTransparency } from '../motion';

/**
 * Like button: the icon scale-pops on tap, and the fill CROSS-FADES from the CTA
 * burgundy to the soft confirmed tone when `sent` flips (a colour that changes in one
 * frame while only the icon animates reads as a glitch, not as a result). Reduce
 * Motion swaps instantly. The tap haptic is `light`: the server has not answered yet,
 * and a mutual match plays its own success haptic in MatchCelebration.
 */
function LikeButton({
  onLike,
  sent,
  idleFill,
  sentFill,
  style,
  iconColor,
  iconSize = 20,
  label,
  labelStyle,
  testID,
  accessibilityLabel,
  disabled,
  iconName = 'heart',
}: {
  onLike: () => void;
  /** Interest already sent: drives the fill cross-fade. */
  sent: boolean;
  idleFill: string;
  sentFill: string;
  style?: StyleProp<ViewStyle>;
  iconColor: string;
  iconSize?: number;
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel: string;
  /** Interest already sent: the control stays visible but can no longer fire. */
  disabled?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
}) {
  const { style: popStyle, pop } = usePop();
  const reduced = useReduceMotion();
  // Starts at the current state, so a row that mounts already-sent does not animate.
  const progress = useSharedValue(sent ? 1 : 0);
  useEffect(() => {
    const target = sent ? 1 : 0;
    progress.value = reduced
      ? target
      : withTiming(target, { duration: duration.menu, easing: Easing.bezier(...EASE_OUT) });
  }, [sent, reduced, progress]);
  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [idleFill, sentFill]),
  }));
  const press = () => {
    haptics.light();
    pop();
    onLike();
  };
  return (
    <PressableScale
      style={[style, fillStyle]}
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={popStyle}>
        <Ionicons name={iconName} size={iconSize} color={iconColor} />
      </Animated.View>
      {label ? (
        // One line by construction: the three actions share a row, so a label
        // that wraps would push the others out of line. It shrinks instead.
        <Text variant="subhead" style={[ls.shrink, labelStyle]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxScale={1.2}>
          {label}
        </Text>
      ) : null}
    </PressableScale>
  );
}

// Layout only, no colour (a module-scope sheet may not carry a light palette).
// `flexShrink: 1` lets adjustsFontSizeToFit see the width left over AFTER the
// icon and gap, not the whole button, so a long label shrinks instead of
// running into its neighbour.
const ls = StyleSheet.create({ shrink: { flexShrink: 1 } });

// The card is capped at 400pt and centred, so on a tablet-width window or in
// split-screen the photo's aspect does not drift away from the card's width.
// SearchScreen's skeleton reads the same three numbers so it never disagrees.
export const CARD_MAX_W = 400;
export const PHOTO_ASPECT = 1.12;
export const cardWidthFor = (windowWidth: number): number =>
  Math.min(windowWidth - spacing.gutter * 2, CARD_MAX_W);
// A photoless member is the common case, so it does not get a photo-shaped block: an
// identity row (circle avatar + text) sized to its content instead of a tile that
// holds one initial. Size of that avatar.
const BARE_AVATAR = 72;

// Tones drawn over a photo. One home for them so the browse cards (this file
// and Home's rail) darken a photo identically instead of each hard-coding its own.
export const PHOTO_SCRIM = {
  mid: 'rgba(20,8,14,0.35)',
  end: 'rgba(20,8,14,0.86)',
  chip: 'rgba(20,8,14,0.72)',
  meta: 'rgba(255,255,255,0.92)',
  glass: 'rgba(255,255,255,0.18)',
  glassBorder: 'rgba(255,255,255,0.28)',
} as const;

// Score colouring: green / accent / soft accent / neutral. `success` reads correctly as
// status text but is documented as unreadable as an accent on a dark
// surfaceCard — `successAccent` is the theme-reactive pair that stays
// legible as a score dot/fill in both themes. Gold is reserved for premium
// signalling and never marks a compatibility score. Real scores cluster at
// 45-70, so the 50-74 tier gets its own tone (`p400`) instead of falling to grey:
// on the card surface it is 3.24:1 light / 5.07:1 dark; on `surface2` 2.97:1 light
// (a hair short of the 3:1 non-text floor) / 4.36:1 dark, so a caller that can
// choose should draw the mark on `surfaceCard`, and every mark sits beside its
// figure. Shared by Home's rail and the Matches rows.
export const scoreColour = (pct: number, c: ThemeColours): string =>
  pct >= 90 ? c.successAccent : pct >= 75 ? c.accent : pct >= 50 ? c.p400 : c.textMuted;

export interface ProfileCardProps {
  profile: ProfileSummary;
  onLike: () => void;
  onShortlist: () => void;
  onPass: () => void;
  onPress: () => void;
  showCompatibility?: boolean;
  /**
   * What the member has already done to this profile in this session. Drives
   * the confirmed state of the Interested / Shortlist buttons so a tap has a
   * visible outcome (and cannot be fired twice).
   */
  sentAction?: 'like' | 'shortlist';
  testID?: string;
}

export default function ProfileCard({
  profile,
  onLike,
  onShortlist,
  onPass,
  onPress,
  showCompatibility = true,
  sentAction,
  testID,
}: ProfileCardProps) {
  const { c, isDark, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  // Live width, not a module-load constant: rotation, split-screen and tablet
  // windows change it, and the photo's height has to follow the card's width.
  const { width: windowWidth } = useWindowDimensions();
  const cardW = cardWidthFor(windowWidth);
  const sh = isDark ? darkShadows : shadows;
  // Elder mode's 60pt floor. The action row is the card's whole decision surface.
  const actionHeight = tapSize(elder);
  // The Boosted tag and compat chip are translucent panels over a photo; with
  // Reduce Transparency on they become solid.
  const reduceTransparency = useReduceTransparency();
  const age = profile.dateOfBirth ? getAge(profile.dateOfBirth) : null;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const first = profile.firstName || 'this profile';
  const photoUri = profile.profilePhoto ?? profile.photos?.[0];
  // A photoless profile (about 60% of members, so the COMMON case) gets an identity row:
  // a circle avatar beside its name, line and score, in normal flow on the card surface.
  // A photo-shaped block holding one initial is a void in a browse list, and white text
  // drawn over the pale initials fill never reaches 4.5:1 (the scrim is nearly clear there).
  const hasPhoto = !!resolveImageUri(photoUri);
  const compat = profile.compatibilityScore ?? 0;
  const liked = sentAction === 'like';
  const shortlisted = sentAction === 'shortlist';
  const shortlistPop = usePop();
  const showCompat = showCompatibility && compat > 0;
  const metaLine = [profile.profession, profile.city].filter(Boolean).join(' · ');

  const openLabel = [
    `${name}${age ? `, ${age}` : ''}`,
    [profile.profession, profile.city].filter(Boolean).join(', ') || null,
    showCompatibility && compat > 0 ? `${compat}% match` : null,
    profile.isVerified ? 'Verified' : null,
    profile.isBoosted ? 'Boosted' : null,
    hasPhoto ? null : 'No photo yet',
  ].filter(Boolean).join('. ');

  return (
    // Outer wrapper owns the gutters and centres the card, so the card can be
    // `width: '100%'` capped at CARD_MAX_W (percent width plus margins overflows).
    <View style={s.outer}>
    {/* Elevation is declared once: a shadow, no border (border + shadow on one
        element is a ghost card). The shadow lives on the card because
        `overflow: hidden` on the same view would clip it on iOS; the clip that
        rounds the photo's corners lives one level in. */}
    <View style={[s.card, { backgroundColor: c.surfaceCard }, sh.e2]}>
      <View style={s.clip}>
        {/* Tappable profile area. The action row below is its sibling, not its child. */}
        <PressableScale
          style={s.photoWrapper}
          scaleTo={0.985}
          onPress={onPress}
          testID={testID ?? `ProfileCard-${profile.id}`}
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          accessibilityHint="Opens profile"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {hasPhoto ? (
            <>
              {/* hideInitial: if the photo fails to load the tile falls back to plain
                  p100, and the name is drawn over it below - a 64pt glyph would collide. */}
              <SmartImage
                uri={photoUri}
                name={name}
                style={[s.photo, { height: Math.round(cardW * PHOTO_ASPECT) }]}
                initialSize={64}
                hideInitial
              />
              <LinearGradient
                colors={['transparent', PHOTO_SCRIM.mid, PHOTO_SCRIM.end]}
                locations={[0.34, 0.58, 1]}
                style={s.scrim}
                pointerEvents="none"
              />

              {/* top-right markers */}
              <View style={s.topRow} pointerEvents="none">
                <View style={{ flex: 1 }} />
                {profile.isBoosted && (
                  <View style={[s.boostedTag, reduceTransparency && { backgroundColor: c.p900 }]}>
                    <Ionicons name="flash" size={11} color={c.onPrimary} />
                    <Text variant="micro" color="onPrimary" maxScale={1.3}>Boosted</Text>
                  </View>
                )}
              </View>

              {/* bottom overlay: text over a photo, so it is capped rather than free to grow */}
              <View style={s.overlay} pointerEvents="none">
                <View style={s.nameRow}>
                  <Text variant="title2" color="onPrimary" numberOfLines={1} maxScale={1.3} style={s.nameText}>{name}{age ? `, ${age}` : ''}</Text>
                  {profile.isVerified && <Ionicons name="checkmark-circle" size={16} color={c.successAccent} />}
                </View>
                <Text variant="footnote" style={s.meta} numberOfLines={1} maxScale={1.3}>
                  {metaLine}
                </Text>
                {showCompat && (
                  <View style={[s.compatChip, reduceTransparency && { backgroundColor: c.p800, borderColor: c.p600 }]}>
                    <View style={[s.compatDot, { backgroundColor: scoreColour(compat, c) }]} />
                    <Text variant="caption" color="onPrimary" maxScale={1.3} style={s.tabular}>{compat}% match</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            // No photo: name, then role, then facts, beside a circle avatar. In flow on the
            // card surface, so it passes AA in both themes and grows with the OS text size
            // (every row is capped by lines, none by height).
            <View style={s.bareRow} pointerEvents="none">
              <Avatar name={name} size={BARE_AVATAR} />
              <View style={s.bareText}>
                <View style={s.nameRow}>
                  <Text variant="title2" color="fgStrong" numberOfLines={2} style={s.nameText}>{name}{age ? `, ${age}` : ''}</Text>
                  {profile.isVerified && <Ionicons name="checkmark-circle" size={16} color={c.successAccent} />}
                </View>
                {metaLine ? (
                  <Text variant="subhead" color="textSecondary" numberOfLines={2} style={s.bareMeta}>
                    {metaLine}
                  </Text>
                ) : null}
                {(showCompat || profile.isBoosted) && (
                  <View style={s.bareFacts}>
                    {showCompat && (
                      // No fill: the score dot is drawn on the card surface itself, where
                      // the burgundy-tint tone clears 3:1 in both themes (on surface2 it is 2.97 light).
                      <View style={[s.bareChip, { borderColor: c.border }]}>
                        <View style={[s.compatDot, { backgroundColor: scoreColour(compat, c) }]} />
                        <Text variant="caption" color="textSecondary" style={s.tabular}>{compat}% match</Text>
                      </View>
                    )}
                    {profile.isBoosted && (
                      <View style={[s.boostedTag, reduceTransparency && { backgroundColor: c.p900 }]}>
                        <Ionicons name="flash" size={11} color={c.onPrimary} />
                        <Text variant="micro" color="onPrimary" maxScale={1.3}>Boosted</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}
        </PressableScale>

        {/* Actions */}
        <View style={[s.actions, { borderTopColor: c.border }]}>
          <PressableScale
            style={[s.actionBtn, { minHeight: actionHeight }]}
            onPress={onPass}
            haptic
            accessibilityRole="button"
            accessibilityLabel={`Pass on ${first}`}
            testID={`pass-${profile.id}`}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={c.textSecondary} />
            <Text variant="subhead" color="textSecondary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxScale={1.2} style={ls.shrink}>Pass</Text>
          </PressableScale>
          <PressableScale
            style={[s.actionBtn, s.actionMid, { borderColor: c.border, minHeight: actionHeight }]}
            onPress={() => { shortlistPop.pop(); onShortlist(); }}
            disabled={shortlisted}
            haptic
            accessibilityRole="button"
            accessibilityLabel={shortlisted ? `${first} shortlisted` : `Shortlist ${first}`}
            accessibilityState={{ selected: shortlisted, disabled: shortlisted }}
            testID={`shortlist-${profile.id}`}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Animated.View style={shortlistPop.style}>
              <Ionicons name={shortlisted ? 'bookmark' : 'bookmark-outline'} size={20} color={c.accent} />
            </Animated.View>
            <Text variant="subhead" color="primary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxScale={1.2} style={ls.shrink}>
              {shortlisted ? 'Shortlisted' : 'Shortlist'}
            </Text>
          </PressableScale>
          <LikeButton
            style={[s.actionBtn, { minHeight: actionHeight }]}
            sent={liked}
            // Primary CTA fill is `p500`, not `accent`: in dark mode `accent` is the lighter
            // #C75D7E, which only reaches 3.97:1 against the white label; `p500` holds in both themes.
            idleFill={c.p500}
            sentFill={c.accentSoft}
            iconColor={liked ? c.accent : c.onPrimary}
            iconName={liked ? 'checkmark' : 'heart'}
            onLike={onLike}
            disabled={liked}
            // "Sent" not "Interest sent": the three actions share one row, and the longer
            // label fell below the shrink floor in elder mode and on 320dp screens. The
            // check icon plus the full accessibilityLabel below carry the meaning.
            label={liked ? 'Sent' : 'Interested'}
            labelStyle={{ color: liked ? c.accent : c.onPrimary }}
            // The label starts with the words on screen ('Interested' / 'Sent') so Voice Control's
            // "tap Interested" resolves; the name follows for everyone else.
            accessibilityLabel={liked ? `Sent. Interest sent to ${first}` : `Interested in ${first}`}
            testID={`like-${profile.id}`}
          />
        </View>
      </View>
    </View>
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  // ── Full card ──────────────────────────────────────────────────────────────
  outer: { paddingHorizontal: spacing.gutter, marginBottom: spacing.lg, alignItems: 'center' },
  card: { width: '100%', maxWidth: CARD_MAX_W, borderRadius: borderRadius.lg },
  clip: { borderRadius: borderRadius.lg, overflow: 'hidden' },
  photoWrapper: { position: 'relative' },
  // Height is set inline from the live window width (see `cardW`).
  photo: { width: '100%', backgroundColor: c.surface2 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  topRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row' },
  // Solid scrim tone, not a burgundy fill: the tag sits on an arbitrary photo
  // and must read on all of them.
  boostedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: PHOTO_SCRIM.chip, borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  overlay: { position: 'absolute', left: 13, right: 13, bottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameText: { flexShrink: 1 },
  meta: { color: PHOTO_SCRIM.meta, marginTop: 2 },
  compatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: PHOTO_SCRIM.glass, borderWidth: 1, borderColor: PHOTO_SCRIM.glassBorder,
    borderRadius: borderRadius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  compatDot: { width: 7, height: 7, borderRadius: 4 },
  // Photoless profile: an identity row on the card surface. `minWidth: 0` on the text
  // column lets its lines wrap inside the row instead of pushing past the card edge.
  bareRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  bareText: { flex: 1, minWidth: 0 },
  bareMeta: { marginTop: 2 },
  // The score chip and the Boosted tag share a wrapping row: at large text or in hi/pa
  // the second one drops to a new line instead of squeezing the first.
  bareFacts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  bareChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: borderRadius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  // Figures that change (a score) keep a fixed digit width so the chip does not shimmy.
  tabular: { fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', borderTopWidth: 1 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: 13, paddingHorizontal: spacing.xs,
  },
  actionMid: { borderLeftWidth: 0.5, borderRightWidth: 0.5 },
});
