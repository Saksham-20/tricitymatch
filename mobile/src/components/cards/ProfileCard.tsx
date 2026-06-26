import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colours, type, spacing, borderRadius, shadows, darkShadows } from '@shared/constants/theme';
import type { ProfileSummary } from '../../types';
import SmartImage from '../common/SmartImage';
import Avatar from '../ui/Avatar';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';

const { width: SCREEN_W } = Dimensions.get('window');

// Score colouring (handoff): green / gold / burgundy.
const scoreColour = (pct: number): string =>
  pct >= 90 ? colours.success : pct >= 75 ? colours.g500 : colours.p500;

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
  const sh = isDark ? darkShadows : shadows;
  const age = ageFromDob(profile.dateOfBirth);
  const name = `${profile.firstName} ${profile.lastName}`;
  const photoUri = profile.profilePhoto ?? profile.photos?.[0];
  const compat = profile.compatibilityScore ?? 0;

  const like = () => { haptics.success(); onLike(); };
  const shortlist = () => { haptics.light(); onShortlist(); };

  if (compact) {
    return (
      <TouchableOpacity
        style={[s.compactCard, { backgroundColor: c.surfaceCard, borderColor: c.border }]}
        onPress={onPress}
        activeOpacity={0.85}
        testID={testID ?? `ProfileCard-${profile.id}`}
        accessibilityLabel={`${name} profile`}
      >
        <Avatar uri={photoUri} name={name} size={64} square verified={profile.isVerified} />
        <View style={s.compactInfo}>
          <Text style={[s.compactName, { color: c.fgStrong }]} numberOfLines={1}>
            {name}{age ? `, ${age}` : ''}
          </Text>
          <Text style={[s.compactSub, { color: c.textMuted }]} numberOfLines={1}>
            {[profile.profession, profile.city].filter(Boolean).join(' · ')}
          </Text>
          {showCompatibility && compat > 0 && (
            <View style={s.compatRow}>
              <View style={[s.compatBar, { backgroundColor: c.surface2 }]}>
                <View style={[s.compatFill, { width: `${compat}%`, backgroundColor: scoreColour(compat) }]} />
              </View>
              <Text style={[s.compatPct, { color: c.textMuted }]}>{compat}%</Text>
            </View>
          )}
        </View>
        <View style={s.compactActions}>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: c.surface2 }]} onPress={shortlist} accessibilityLabel="Shortlist" testID={`shortlist-${profile.id}`}>
            <Ionicons name="bookmark-outline" size={20} color={colours.g600} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: colours.accentSoft }]} onPress={like} accessibilityLabel="Like" testID={`like-${profile.id}`}>
            <Ionicons name="heart" size={20} color={colours.accent} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.surfaceCard, borderColor: c.border }, sh.e2]}
      onPress={onPress}
      activeOpacity={0.92}
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
              <Text style={s.boostedText}>Boosted</Text>
            </View>
          )}
        </View>

        {/* bottom overlay */}
        <View style={s.overlay} pointerEvents="none">
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{name}{age ? `, ${age}` : ''}</Text>
            {profile.isVerified && <Ionicons name="checkmark-circle" size={16} color="#5DD27A" />}
          </View>
          <Text style={s.meta} numberOfLines={1}>
            {[profile.profession, profile.city].filter(Boolean).join(' · ')}
          </Text>
          {showCompatibility && compat > 0 && (
            <View style={s.compatChip}>
              <View style={[s.compatDot, { backgroundColor: scoreColour(compat) }]} />
              <Text style={s.compatChipText}>{compat}% match</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={[s.actions, { borderTopColor: c.border }]}>
        <TouchableOpacity style={s.actionBtn} onPress={onPass} accessibilityLabel="Pass" testID={`pass-${profile.id}`}>
          <Ionicons name="close" size={20} color={c.textSecondary} />
          <Text style={[s.actionLabel, { color: c.textSecondary }]}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.actionMid, { borderColor: c.border }]} onPress={shortlist} accessibilityLabel="Shortlist" testID={`shortlist-${profile.id}`}>
          <Ionicons name="bookmark-outline" size={20} color={colours.g600} />
          <Text style={[s.actionLabel, { color: colours.g600 }]}>Shortlist</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.likeBtn]} onPress={like} accessibilityLabel="Like" testID={`like-${profile.id}`}>
          <Ionicons name="heart" size={20} color="#fff" />
          <Text style={[s.actionLabel, { color: '#fff' }]}>Interested</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const CARD_W = Math.min(SCREEN_W - spacing.gutter * 2, 400);

const s = StyleSheet.create({
  // ── Full card ──────────────────────────────────────────────────────────────
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginHorizontal: spacing.gutter,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  photoWrapper: { position: 'relative' },
  photo: { width: '100%', height: CARD_W * 1.12, backgroundColor: colours.surface2 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  topRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row' },
  boostedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colours.accent, borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  boostedText: { ...type.micro, color: '#fff' },
  overlay: { position: 'absolute', left: 13, right: 13, bottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...type.title3, fontFamily: 'PlayfairDisplay-Bold', color: '#fff' },
  meta: { ...type.footnote, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  compatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: borderRadius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  compatDot: { width: 7, height: 7, borderRadius: 4 },
  compatChipText: { ...type.caption, color: '#fff' },
  actions: { flexDirection: 'row', borderTopWidth: 1 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: 13,
  },
  actionMid: { borderLeftWidth: 0.5, borderRightWidth: 0.5 },
  actionLabel: { ...type.subhead, fontFamily: 'Inter-SemiBold' },
  likeBtn: { backgroundColor: colours.accent },

  // ── Compact row ──────────────────────────────────────────────────────────
  compactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: spacing.gutter, paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  compactInfo: { flex: 1 },
  compactName: { ...type.headline, color: colours.fgStrong },
  compactSub: { ...type.footnote, color: colours.textMuted, marginTop: 1 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 6 },
  compatBar: { flex: 1, height: 5, backgroundColor: colours.surface2, borderRadius: borderRadius.pill, overflow: 'hidden' },
  compatFill: { height: 5, borderRadius: borderRadius.pill },
  compatPct: { ...type.caption, color: colours.textMuted, minWidth: 32, textAlign: 'right' },
  compactActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.pill },
});
