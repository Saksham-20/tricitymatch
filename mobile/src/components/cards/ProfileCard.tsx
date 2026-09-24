import React from 'react';
import { View, StyleSheet, useWindowDimensions, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Text from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { spacing, borderRadius, shadows, darkShadows, type ThemeColours } from '@shared/constants/theme';
import type { ProfileSummary } from '../../types';
import SmartImage, { resolveImageUri } from '../common/SmartImage';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import { getAge } from '../../utils/dateUtils';
import { tapSize } from '../../utils/elderTheme';
import { PressableScale, usePop, useReduceTransparency } from '../motion';

/** Like button with the handoff icon scale-pop + success haptic on tap. */
function LikeButton({
  onLike,
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
  const press = () => {
    haptics.success();
    pop();
    onLike();
  };
  return (
    <PressableScale
      style={style}
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
// A photoless tile only has to hold an initial, so it is a fraction of the photo's.
const BARE_ASPECT = 0.36;

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

// Score colouring: green / accent / neutral. `success` reads correctly as
// status text but is documented as unreadable as an accent on a dark
// surfaceCard — `successAccent` is the theme-reactive pair that stays
// legible as a score dot/fill in both themes. Gold is reserved for premium
// signalling and never marks a compatibility score. Shared by Home's rail and
// the Matches rows.
export const scoreColour = (pct: number, c: ThemeColours): string =>
  pct >= 90 ? c.successAccent : pct >= 75 ? c.accent : c.textMuted;

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
  // A photoless profile gets a short tile that holds only the initial, with its
  // name, line and score in normal flow beneath it. A full-height block holding
  // one initial is a void in a browse list, and white text drawn over the pale
  // initials fill never reaches 4.5:1 (the scrim is nearly clear there).
  const hasPhoto = !!resolveImageUri(photoUri);
  const compat = profile.compatibilityScore ?? 0;
  const liked = sentAction === 'like';
  const shortlisted = sentAction === 'shortlist';

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
          <SmartImage
            uri={photoUri}
            name={name}
            style={[s.photo, { height: Math.round(cardW * (hasPhoto ? PHOTO_ASPECT : BARE_ASPECT)) }]}
            initialSize={hasPhoto ? 64 : 48}
          />
          {hasPhoto && (
            <LinearGradient
              colors={['transparent', PHOTO_SCRIM.mid, PHOTO_SCRIM.end]}
              locations={[0.34, 0.58, 1]}
              style={s.scrim}
              pointerEvents="none"
            />
          )}

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

          {hasPhoto ? (
            // bottom overlay: text over a photo, so it is capped rather than free to grow
            <View style={s.overlay} pointerEvents="none">
              <View style={s.nameRow}>
                <Text variant="title2" color="onPrimary" numberOfLines={1} maxScale={1.3} style={s.nameText}>{name}{age ? `, ${age}` : ''}</Text>
                {profile.isVerified && <Ionicons name="checkmark-circle" size={16} color={c.successAccent} />}
              </View>
              <Text variant="footnote" style={s.meta} numberOfLines={1} maxScale={1.3}>
                {[profile.profession, profile.city].filter(Boolean).join(' · ')}
              </Text>
              {showCompatibility && compat > 0 && (
                <View style={[s.compatChip, reduceTransparency && { backgroundColor: c.p800, borderColor: c.p600 }]}>
                  <View style={[s.compatDot, { backgroundColor: scoreColour(compat, c) }]} />
                  <Text variant="caption" color="onPrimary" maxScale={1.3}>{compat}% match</Text>
                </View>
              )}
            </View>
          ) : (
            // No photo: the same facts on the card surface, in flow, so they pass AA in
            // both themes and grow with the OS text size instead of being clipped.
            <View style={s.bareBody} pointerEvents="none">
              <View style={s.nameRow}>
                <Text variant="title2" color="fgStrong" numberOfLines={2} style={s.nameText}>{name}{age ? `, ${age}` : ''}</Text>
                {profile.isVerified && <Ionicons name="checkmark-circle" size={16} color={c.successAccent} />}
              </View>
              {[profile.profession, profile.city].filter(Boolean).length > 0 && (
                <Text variant="footnote" color="textSecondary" numberOfLines={2} style={s.bareMeta}>
                  {[profile.profession, profile.city].filter(Boolean).join(' · ')}
                </Text>
              )}
              {showCompatibility && compat > 0 && (
                <View style={[s.bareChip, { backgroundColor: c.surface2, borderColor: c.border }]}>
                  <View style={[s.compatDot, { backgroundColor: scoreColour(compat, c) }]} />
                  <Text variant="caption" color="textSecondary">{compat}% match</Text>
                </View>
              )}
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
            onPress={onShortlist}
            disabled={shortlisted}
            haptic
            accessibilityRole="button"
            accessibilityLabel={shortlisted ? `${first} shortlisted` : `Shortlist ${first}`}
            accessibilityState={{ selected: shortlisted, disabled: shortlisted }}
            testID={`shortlist-${profile.id}`}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={shortlisted ? 'bookmark' : 'bookmark-outline'} size={20} color={c.accent} />
            <Text variant="subhead" color="primary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxScale={1.2} style={ls.shrink}>
              {shortlisted ? 'Shortlisted' : 'Shortlist'}
            </Text>
          </PressableScale>
          <LikeButton
            style={[s.actionBtn, liked ? s.likedBtn : s.likeBtn, { minHeight: actionHeight }]}
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
  // Photoless profile: facts sit on the card surface beneath the initials tile.
  bareBody: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 14 },
  bareMeta: { marginTop: 2 },
  bareChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8,
    borderWidth: 1, borderRadius: borderRadius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  actions: { flexDirection: 'row', borderTopWidth: 1 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: 13, paddingHorizontal: spacing.xs,
  },
  actionMid: { borderLeftWidth: 0.5, borderRightWidth: 0.5 },
  // Primary CTA fill: `p500`, not `accent`. In dark mode `accent` is the lighter
  // #C75D7E, which only reaches 3.97:1 against the white label; `p500` holds in both themes.
  likeBtn: { backgroundColor: c.p500 },
  likedBtn: { backgroundColor: c.accentSoft },
});
