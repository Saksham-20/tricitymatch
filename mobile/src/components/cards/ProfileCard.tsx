import React from 'react';
import { View, StyleSheet, Dimensions, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Text from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { colours, spacing, borderRadius, shadows, darkShadows, type ThemeColours } from '@shared/constants/theme';
import type { ProfileSummary } from '../../types';
import SmartImage from '../common/SmartImage';
import Avatar from '../ui/Avatar';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import { PressableScale, usePop } from '../motion';

/** Like button with the handoff icon scale-pop + success haptic on tap. */
function LikeButton({
  onLike,
  style,
  iconColor,
  iconSize = 20,
  label,
  labelStyle,
  testID,
}: {
  onLike: () => void;
  style?: StyleProp<ViewStyle>;
  iconColor: string;
  iconSize?: number;
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
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
      accessibilityRole="button"
      accessibilityLabel="Like"
      testID={testID}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={popStyle}>
        <Ionicons name="heart" size={iconSize} color={iconColor} />
      </Animated.View>
      {label ? <Text variant="subhead" style={labelStyle}>{label}</Text> : null}
    </PressableScale>
  );
}

const { width: SCREEN_W } = Dimensions.get('window');

// Score colouring (handoff): green / gold / burgundy. `success` reads
// correctly as status text but is documented as unreadable as an accent on
// a dark surfaceCard — `successAccent` is the theme-reactive pair that
// stays legible as a score dot/fill in both themes.
const scoreColour = (pct: number, c: ThemeColours): string =>
  pct >= 90 ? c.successAccent : pct >= 75 ? colours.g500 : colours.p500;

export interface ProfileCardProps {
  profile: ProfileSummary;
  onLike: () => void;
  onShortlist: () => void;
  onPass: () => void;
  onPress: () => void;
  showCompatibility?: boolean;
  compact?: boolean;
  testID?: string;
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function ProfileCard({
  profile,
  onLike,
  onShortlist,
  onPass,
  onPress,
  showCompatibility = true,
  compact = false,
  testID,
}: ProfileCardProps) {
  const { c, isDark } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const sh = isDark ? darkShadows : shadows;
  const age = ageFromDob(profile.dateOfBirth);
  const name = `${profile.firstName} ${profile.lastName}`;
  const photoUri = profile.profilePhoto ?? profile.photos?.[0];
  const compat = profile.compatibilityScore ?? 0;

  const shortlist = () => { onShortlist(); };

  if (compact) {
    return (
      <PressableScale
        style={[s.compactCard, { backgroundColor: c.surfaceCard, borderColor: c.border }]}
        onPress={onPress}
        testID={testID ?? `ProfileCard-${profile.id}`}
        accessibilityLabel={`${name} profile`}
      >
        <Avatar uri={photoUri} name={name} size={64} square verified={profile.isVerified} />
        <View style={s.compactInfo}>
          <Text variant="headline" color="fgStrong" numberOfLines={1}>
            {name}{age ? `, ${age}` : ''}
          </Text>
          <Text variant="footnote" color="textMuted" style={s.compactSub} numberOfLines={1}>
            {[profile.profession, profile.city].filter(Boolean).join(' · ')}
          </Text>
          {showCompatibility && compat > 0 && (
            <View style={s.compatRow}>
              <View style={[s.compatBar, { backgroundColor: c.surface2 }]}>
                <View style={[s.compatFill, { width: `${compat}%`, backgroundColor: scoreColour(compat, c) }]} />
              </View>
              <Text variant="caption" color="textMuted" style={s.compatPct}>{compat}%</Text>
            </View>
          )}
        </View>
        <View style={s.compactActions}>
          <PressableScale
            style={[s.iconBtn, { backgroundColor: c.surface2 }]}
            onPress={shortlist}
            haptic
            accessibilityRole="button"
            accessibilityLabel="Shortlist"
            testID={`shortlist-${profile.id}`}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="bookmark-outline" size={20} color={c.accent} />
          </PressableScale>
          <LikeButton
            style={[s.iconBtn, { backgroundColor: c.accentSoft }]}
            iconColor={c.accent}
            onLike={onLike}
            testID={`like-${profile.id}`}
          />
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      style={[s.card, { backgroundColor: c.surfaceCard, borderColor: c.border }, sh.e2]}
      onPress={onPress}
      testID={testID ?? `ProfileCard-${profile.id}`}
      accessibilityLabel={`${name} profile`}
    >
      {/* Photo with scrim + overlay info */}
      <View style={s.photoWrapper}>
        <SmartImage uri={photoUri} name={name} style={s.photo} initialSize={64} />
        <LinearGradient
          colors={['transparent', 'rgba(20,8,14,0.35)', 'rgba(20,8,14,0.86)']}
          locations={[0.34, 0.58, 1]}
          style={s.scrim}
          pointerEvents="none"
        />

        {/* top-right markers */}
        <View style={s.topRow} pointerEvents="none">
          <View style={{ flex: 1 }} />
          {profile.isBoosted && (
            <View style={s.boostedTag}>
              <Ionicons name="flash" size={11} color="#fff" />
              <Text variant="micro" color="onPrimary">Boosted</Text>
            </View>
          )}
        </View>

        {/* bottom overlay */}
        <View style={s.overlay} pointerEvents="none">
          <View style={s.nameRow}>
            <Text variant="title2" color="onPrimary" numberOfLines={1}>{name}{age ? `, ${age}` : ''}</Text>
            {profile.isVerified && <Ionicons name="checkmark-circle" size={16} color={c.success} />}
          </View>
          <Text variant="footnote" style={s.meta} numberOfLines={1}>
            {[profile.profession, profile.city].filter(Boolean).join(' · ')}
          </Text>
          {showCompatibility && compat > 0 && (
            <View style={s.compatChip}>
              <View style={[s.compatDot, { backgroundColor: scoreColour(compat, c) }]} />
              <Text variant="caption" color="onPrimary">{compat}% match</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={[s.actions, { borderTopColor: c.border }]}>
        <PressableScale
          style={s.actionBtn}
          onPress={onPass}
          accessibilityRole="button"
          accessibilityLabel="Pass"
          testID={`pass-${profile.id}`}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={c.textSecondary} />
          <Text variant="subhead" color="textSecondary">Pass</Text>
        </PressableScale>
        <PressableScale
          style={[s.actionBtn, s.actionMid, { borderColor: c.border }]}
          onPress={shortlist}
          haptic
          accessibilityRole="button"
          accessibilityLabel="Shortlist"
          testID={`shortlist-${profile.id}`}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="bookmark-outline" size={20} color={c.accent} />
          <Text variant="subhead" color="primary">Shortlist</Text>
        </PressableScale>
        <LikeButton
          style={[s.actionBtn, s.likeBtn]}
          iconColor="#fff"
          onLike={onLike}
          label="Interested"
          labelStyle={{ color: '#fff' }}
          testID={`like-${profile.id}`}
        />
      </View>
    </PressableScale>
  );
}

const CARD_W = Math.min(SCREEN_W - spacing.gutter * 2, 400);

const makeS = (c: ThemeColours) => StyleSheet.create({
  // ── Full card ──────────────────────────────────────────────────────────────
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginHorizontal: spacing.gutter,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  photoWrapper: { position: 'relative' },
  photo: { width: '100%', height: CARD_W * 1.12, backgroundColor: c.surface2 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  topRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row' },
  boostedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: c.accent, borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  overlay: { position: 'absolute', left: 13, right: 13, bottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  compatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: borderRadius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  compatDot: { width: 7, height: 7, borderRadius: 4 },
  actions: { flexDirection: 'row', borderTopWidth: 1 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: 13,
  },
  actionMid: { borderLeftWidth: 0.5, borderRightWidth: 0.5 },
  likeBtn: { backgroundColor: c.accent },

  // ── Compact row ──────────────────────────────────────────────────────────
  compactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: spacing.gutter, paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  compactInfo: { flex: 1 },
  compactSub: { marginTop: 1 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 6 },
  compatBar: { flex: 1, height: 5, backgroundColor: c.surface2, borderRadius: borderRadius.pill, overflow: 'hidden' },
  compatFill: { height: 5, borderRadius: borderRadius.pill },
  compatPct: { minWidth: 32, textAlign: 'right' },
  compactActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.pill },
});
