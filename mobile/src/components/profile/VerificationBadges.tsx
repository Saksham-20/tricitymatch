import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { PressableScale } from '../motion';
import Text from '../ui/Text';
import type { PhotoVerification } from '../../types';

/**
 * The member's own verification row: two badges, because two verifications
 * exist.
 *
 *   Mobile  reads `phoneVerified` (OTP at signup).
 *   Photo   reads `Verification.status` (a live selfie a person matches against
 *           the profile photos).
 *
 * This file used to describe a four-rung ladder (Mobile / ID / Education /
 * Income) left over from a verification model the product removed: government
 * ID collection went in 2026-07 and education / income verification never had
 * a backend. It had no importers, while OwnProfileScreen carried its own private
 * copy of a two-tier row. This is now the one component, and nothing in it is
 * hardcoded: every badge is derived from the state passed in.
 *
 * `photoStatus="unknown"` means the status has not loaded (or failed to). The
 * badge then renders neutral and no call to action is offered, rather than
 * claiming "not verified" about a member who may well be.
 */
export type PhotoBadgeStatus = PhotoVerification['status'] | 'unknown';

/** A decorative glyph: the screen reader skips it and reads the text beside it. */
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

interface Props {
  phoneVerified: boolean;
  photoStatus: PhotoBadgeStatus;
  /** Opens the verification screen. Omit to render the badges without a CTA. */
  onGetVerified?: () => void;
}

interface Pill {
  key: string;
  label: string;
  a11y: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  earned: boolean;
}

const ctaLabel = (status: PhotoBadgeStatus): string | null => {
  switch (status) {
    case 'not_submitted':
      return 'Get verified';
    case 'rejected':
      return 'Retake your selfie';
    case 'pending':
    case 'flagged': // internal admin state: to the member it is still in review
      return 'See verification status';
    default:
      return null; // approved (nothing to do) or unknown (do not guess)
  }
};

export default function VerificationBadges({ phoneVerified, photoStatus, onGetVerified }: Props) {
  const { c, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);

  const pills: Pill[] = [
    {
      key: 'mobile',
      label: phoneVerified ? 'Mobile verified' : 'Mobile not verified',
      a11y: phoneVerified ? 'Mobile number verified' : 'Mobile number not verified',
      icon: phoneVerified ? 'checkmark-circle' : 'ellipse-outline',
      // Success hue for every earned badge; the palette's per-tier badge colours
      // (blue ID, green mobile) made "verified" mean two different colours.
      tint: phoneVerified ? c.successAccent : c.textMuted,
      earned: phoneVerified,
    },
    photoStatus === 'approved'
      ? { key: 'photo', label: 'Photo verified', a11y: 'Photo verified', icon: 'checkmark-circle', tint: c.successAccent, earned: true }
      : photoStatus === 'pending' || photoStatus === 'flagged'
        ? { key: 'photo', label: 'Photo in review', a11y: 'Photo verification in review', icon: 'time-outline', tint: c.warning, earned: false }
        : photoStatus === 'unknown'
          ? { key: 'photo', label: 'Photo', a11y: 'Photo verification status unavailable', icon: 'ellipse-outline', tint: c.textMuted, earned: false }
          : { key: 'photo', label: 'Photo not verified', a11y: 'Photo not verified', icon: 'ellipse-outline', tint: c.textMuted, earned: false },
  ];

  const cta = onGetVerified ? ctaLabel(photoStatus) : null;

  return (
    <View style={s.container} testID="VerificationBadges">
      <View style={s.row}>
        {pills.map((p) => (
          <View
            key={p.key}
            style={[s.badge, { borderColor: p.earned ? p.tint : c.border }]}
            accessible
            accessibilityLabel={p.a11y}
          >
            <Ionicons name={p.icon} size={14} color={p.tint} {...HIDE_FROM_A11Y} />
            {/* Label stays a text colour: the tint is a status hue that does not
                clear 4.5:1 as text on the dark background. The icon carries it.
                An unearned state is information ("not verified"), not decoration,
                so it takes textSecondary: light-mode textMuted is about 3.4:1. */}
            <Text variant="footnote" color={p.earned ? 'textPrimary' : 'textSecondary'}>{p.label}</Text>
          </View>
        ))}
      </View>
      {cta && onGetVerified ? (
        <PressableScale
          style={[s.cta, { backgroundColor: c.accentSoft, minHeight: tapSize(elder) }]}
          onPress={onGetVerified}
          testID="get-verified-cta"
          accessibilityRole="button"
          accessibilityLabel={cta}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={c.primary} {...HIDE_FROM_A11Y} />
          <Text variant="subhead" color="primary" style={s.ctaText}>{cta}</Text>
          <Ionicons name="chevron-forward" size={16} color={c.primary} {...HIDE_FROM_A11Y} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ctaText: { flex: 1 },
});
