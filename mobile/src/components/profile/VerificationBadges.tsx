import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { PressableScale } from '../motion';
import Text from '../ui/Text';
import type { PhotoVerification } from '../../types';

/**
 * The member's own verification row.
 *
 *   Mobile  reads `phoneVerified` (OTP at signup). It is shown ONLY when true.
 *           The number can be verified at signup and nowhere else in the app, so
 *           an email signup would read "Mobile not verified" forever with nothing
 *           to press: a permanent negative label that no action clears.
 *   Photo   reads `Verification.status` (a live selfie a person matches against
 *           the profile photos). This one can be earned, so while it is not done
 *           the label and its call to action are ONE row ("Photo not verified ·
 *           Get verified") instead of a pill plus a separate bar competing for the
 *           same tap.
 *
 * This file used to describe a four-rung ladder (Mobile / ID / Education /
 * Income) left over from a verification model the product removed: government
 * ID collection went in 2026-07 and education / income verification never had
 * a backend. Nothing in it is hardcoded: every badge is derived from the state
 * passed in.
 *
 * `photoStatus="unknown"` means the status has not loaded (or failed to). The
 * photo item is then omitted entirely, rather than claiming "not verified"
 * about a member who may well be.
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
  /** Opens the verification screen. Omit to render the state without a call to action. */
  onGetVerified?: () => void;
}

interface EarnedPill {
  key: string;
  label: string;
  a11y: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}

/** The action half of the photo row, per status: [label, call to action]. */
const photoActionCopy = (
  status: PhotoBadgeStatus,
  t: TFunction,
): { label: string; cta: string } | null => {
  switch (status) {
    case 'not_submitted':
      return { label: t('ownProfile.photoNotVerified', 'Photo not verified'), cta: t('ownProfile.getVerified', 'Get verified') };
    case 'rejected':
      return { label: t('ownProfile.photoNotVerified', 'Photo not verified'), cta: t('ownProfile.retakeSelfie', 'Retake your selfie') };
    case 'pending':
    case 'flagged': // internal admin state: to the member it is still in review
      return { label: t('ownProfile.photoInReview', 'Photo in review'), cta: t('ownProfile.seeStatus', 'See status') };
    default:
      return null; // approved (nothing to do) or unknown (do not guess)
  }
};

export default function VerificationBadges({ phoneVerified, photoStatus, onGetVerified }: Props) {
  const { c, elder } = useTheme();
  const { t } = useTranslation();
  const s = React.useMemo(() => makeS(c), [c]);

  const earned: EarnedPill[] = [];
  if (phoneVerified) {
    earned.push({
      key: 'mobile',
      label: t('ownProfile.mobileVerified', 'Mobile verified'),
      a11y: t('ownProfile.mobileVerifiedA11y', 'Mobile number verified'),
      icon: 'checkmark-circle',
      // Success hue for every earned badge; the palette's per-tier badge colours
      // (blue ID, green mobile) made "verified" mean two different colours.
      tint: c.successAccent,
    });
  }
  if (photoStatus === 'approved') {
    earned.push({
      key: 'photo',
      label: t('ownProfile.photoVerified', 'Photo verified'),
      a11y: t('ownProfile.photoVerified', 'Photo verified'),
      icon: 'checkmark-circle',
      tint: c.successAccent,
    });
  }

  const action = photoActionCopy(photoStatus, t);
  // One row: the state and the way to change it. Without a handler the same words
  // render as plain text, so a caller that cannot navigate never shows a dead button.
  const inReview = photoStatus === 'pending' || photoStatus === 'flagged';
  const rowIcon: keyof typeof Ionicons.glyphMap = inReview ? 'time-outline' : 'shield-checkmark-outline';

  if (earned.length === 0 && !action) return null;

  return (
    <View style={s.container} testID="VerificationBadges">
      {earned.length > 0 && (
        <View style={s.row}>
          {earned.map((p) => (
            <View
              key={p.key}
              style={[s.badge, { borderColor: p.tint }]}
              accessible
              accessibilityLabel={p.a11y}
            >
              <Ionicons name={p.icon} size={14} color={p.tint} {...HIDE_FROM_A11Y} />
              {/* Label stays a text colour: the tint is a status hue that does not
                  clear 4.5:1 as text on the dark background. The icon carries it. */}
              <Text variant="footnote" color="textPrimary">{p.label}</Text>
            </View>
          ))}
        </View>
      )}
      {action ? (
        onGetVerified ? (
          <PressableScale
            style={[s.cta, { backgroundColor: c.accentSoft, minHeight: tapSize(elder) }]}
            onPress={onGetVerified}
            testID="get-verified-cta"
            accessibilityRole="button"
            accessibilityLabel={`${action.label}. ${action.cta}`}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={rowIcon} size={16} color={c.primary} {...HIDE_FROM_A11Y} />
            {/* One sentence, two weights: the state reads quietly, the way out reads as the action.
                Wraps rather than clipping in hi/pa, where both halves run about 30% longer. */}
            <Text variant="subhead" numberOfLines={2} style={s.ctaText}>
              <Text variant="subhead" color="textSecondary">{action.label}</Text>
              <Text variant="subhead" color="textSecondary">{' · '}</Text>
              <Text variant="subhead" color="primary">{action.cta}</Text>
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.primary} {...HIDE_FROM_A11Y} />
          </PressableScale>
        ) : (
          <View style={[s.cta, { backgroundColor: c.surface2 }]} accessible accessibilityLabel={action.label}>
            <Ionicons name={rowIcon} size={16} color={c.textSecondary} {...HIDE_FROM_A11Y} />
            <Text variant="subhead" color="textSecondary" style={s.ctaText}>{action.label}</Text>
          </View>
        )
      ) : null}
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container: { paddingHorizontal: spacing.gutter, marginBottom: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
