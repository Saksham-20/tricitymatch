import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import type { ProfileSummary } from '../../types';
import SmartImage from '../common/SmartImage';

const { width: SCREEN_W } = Dimensions.get('window');

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
  const age = ageFromDob(profile.dateOfBirth);
  const name = `${profile.firstName} ${profile.lastName}`;
  const photoUri = profile.profilePhoto ?? profile.photos?.[0];
  const compat = profile.compatibilityScore ?? 0;

  if (compact) {
    return (
      <TouchableOpacity
        style={s.compactCard}
        onPress={onPress}
        activeOpacity={0.85}
        testID={testID ?? `ProfileCard-${profile.id}`}
        accessibilityLabel={`${name} profile`}
      >
        <View style={s.compactPhotoWrapper}>
          <SmartImage uri={photoUri} name={name} style={s.compactPhoto} initialSize={22} />
          {profile.isVerified && (
            <View style={s.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colours.success} />
            </View>
          )}
        </View>
        <View style={s.compactInfo}>
          <Text style={s.compactName} numberOfLines={1}>{name}{age ? `, ${age}` : ''}</Text>
          <Text style={s.compactSub} numberOfLines={1}>
            {[profile.profession, profile.city].filter(Boolean).join(' · ')}
          </Text>
          {showCompatibility && compat > 0 && (
            <View style={s.compatRow}>
              <View style={s.compatBar}>
                <View style={[s.compatFill, { width: `${compat}%` }]} />
              </View>
              <Text style={s.compatPct}>{compat}%</Text>
            </View>
          )}
        </View>
        <View style={s.compactActions}>
          <TouchableOpacity style={s.iconBtn} onPress={onLike} accessibilityLabel="Like" testID={`like-${profile.id}`}>
            <Ionicons name="heart" size={22} color={colours.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={onShortlist} accessibilityLabel="Shortlist" testID={`shortlist-${profile.id}`}>
            <Ionicons name="bookmark" size={22} color={colours.secondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      activeOpacity={0.92}
      testID={testID ?? `ProfileCard-${profile.id}`}
      accessibilityLabel={`${name} profile`}
    >
      {/* Photo */}
      <View style={s.photoWrapper}>
        <SmartImage uri={photoUri} name={name} style={s.photo} initialSize={64} />
        {profile.isBoosted && (
          <View style={s.boostedTag}>
            <Ionicons name="flash" size={12} color="#fff" />
            <Text style={s.boostedText}>Boosted</Text>
          </View>
        )}
      </View>

      {/* Badges */}
      <View style={s.badgesRow}>
        {profile.isVerified && (
          <View style={[s.badge, { backgroundColor: colours.badgeMobile + '20' }]}>
            <Ionicons name="checkmark-circle" size={12} color={colours.badgeMobile} />
            <Text style={[s.badgeText, { color: colours.badgeMobile }]}>Verified</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>
          {name}{age ? `, ${age}` : ''}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {[profile.city, profile.state].filter(Boolean).join(', ')}
        </Text>
        {(profile.profession || profile.education) && (
          <Text style={s.sub2} numberOfLines={1}>
            {[profile.profession, profile.education].filter(Boolean).join(' · ')}
          </Text>
        )}

        {/* Compatibility */}
        {showCompatibility && compat > 0 && (
          <View style={s.compatContainer}>
            <View style={s.compatBarFull}>
              <View style={[s.compatFillFull, { width: `${compat}%` }]} />
            </View>
            <Text style={s.compatLabel}>Compatibility: {compat}%</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity
          style={[s.actionBtn, s.passBtn]}
          onPress={onPass}
          accessibilityLabel="Pass"
          testID={`pass-${profile.id}`}
        >
          <Ionicons name="close" size={20} color={colours.textSecondary} />
          <Text style={[s.actionLabel, { color: colours.textSecondary }]}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, s.shortlistBtn]}
          onPress={onShortlist}
          accessibilityLabel="Shortlist"
          testID={`shortlist-${profile.id}`}
        >
          <Ionicons name="bookmark" size={20} color={colours.secondary} />
          <Text style={[s.actionLabel, { color: colours.secondary }]}>Shortlist</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, s.likeBtn]}
          onPress={onLike}
          accessibilityLabel="Like"
          testID={`like-${profile.id}`}
        >
          <Ionicons name="heart" size={20} color="#fff" />
          <Text style={[s.actionLabel, { color: '#fff' }]}>Interested</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const CARD_W = Math.min(SCREEN_W - spacing.lg * 2, 400);

const s = StyleSheet.create({
  // ── Card (full) ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: colours.background,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  photoWrapper: { position: 'relative' },
  photo: {
    width: '100%',
    height: CARD_W * 1.1,
    backgroundColor: colours.surfaceCard,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostedTag: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: 3,
  },
  boostedText: {
    fontSize: typography.fontSize.xs,
    color: '#fff',
    fontFamily: typography.fontFamily.semiBold,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  info: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  name: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  sub: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  sub2: {
    fontSize: typography.fontSize.sm,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
    marginTop: 1,
  },
  compatContainer: { marginTop: spacing.sm },
  compatBarFull: {
    height: 6,
    backgroundColor: colours.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  compatFillFull: {
    height: 6,
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
  },
  compatLabel: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colours.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  actionLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
  passBtn: { borderRightWidth: 0.5, borderRightColor: colours.border },
  shortlistBtn: {
    borderRightWidth: 0.5,
    borderRightColor: colours.border,
    borderLeftWidth: 0.5,
    borderLeftColor: colours.border,
  },
  likeBtn: {
    backgroundColor: colours.primary,
    borderBottomRightRadius: borderRadius.lg,
  },

  // ── Compact (list row) ───────────────────────────────────────────────────
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  compactPhotoWrapper: { position: 'relative', marginRight: spacing.md },
  compactPhoto: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colours.surfaceCard,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colours.background,
    borderRadius: borderRadius.full,
  },
  compactInfo: { flex: 1, marginRight: spacing.sm },
  compactName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  compactSub: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  compatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  compatBar: {
    flex: 1,
    height: 4,
    backgroundColor: colours.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  compatFill: {
    height: 4,
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
  },
  compatPct: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.medium,
    minWidth: 30,
  },
  compactActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colours.surfaceCard,
  },
});
