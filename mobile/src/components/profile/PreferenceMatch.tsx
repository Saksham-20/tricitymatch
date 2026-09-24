import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '@shared/constants/theme';
import type { Profile } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import Card from '../ui/Card';
import Text from '../ui/Text';

/**
 * Reverse partner-preference checklist — "Do you fit what X is looking for?".
 * Takes the TARGET's stated preferences and checks each against the VIEWER's own
 * profile, line by line. Port of the web `PreferenceMatch` (Jeevansathi-style
 * standout panel). ok=true match · ok=false miss · ok=null viewer hasn't filled
 * that field (neutral, excluded from the score denominator).
 */

const ageFromDob = (dob: string | null): number | null => {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000));
};

const cmToFeet = (cm: number): string => {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};

const looseMatch = (pref: string, own: string): boolean =>
  own.toLowerCase().includes(pref.toLowerCase()) ||
  pref.toLowerCase().includes(own.toLowerCase());

/** "25 to 30 yrs" / "25+ yrs" / "up to 30 yrs" — no placeholder glyph for a missing bound. */
const rangeText = (min: string | null, max: string | null, unit = ''): string => {
  const tail = unit ? ` ${unit}` : '';
  if (min && max) return `${min} to ${max}${tail}`;
  if (min) return `${min}+${tail}`;
  return `up to ${max}${tail}`;
};

interface Check {
  label: string;
  want: string;
  ok: boolean | null;
  /** Free text the target typed (education, city…) is title-cased; numeric ranges are left alone. */
  freeText?: boolean;
}

export const buildPreferenceChecks = (target: Profile, viewer: Profile | undefined): Check[] => {
  if (!target || !viewer) return [];
  const checks: Check[] = [];

  if (target.preferredAgeMin || target.preferredAgeMax) {
    const age = ageFromDob(viewer.dateOfBirth);
    const min = target.preferredAgeMin;
    const max = target.preferredAgeMax;
    checks.push({
      label: 'Age',
      want: rangeText(min ? String(min) : null, max ? String(max) : null, 'yrs'),
      ok: age == null ? null : (!min || age >= min) && (!max || age <= max),
    });
  }

  if (target.preferredHeightMin || target.preferredHeightMax) {
    const h = viewer.height;
    const min = target.preferredHeightMin;
    const max = target.preferredHeightMax;
    checks.push({
      label: 'Height',
      want: rangeText(min ? cmToFeet(min) : null, max ? cmToFeet(max) : null),
      ok: !h ? null : (!min || h >= min) && (!max || h <= max),
    });
  }

  if (target.preferredEducation) {
    checks.push({
      label: 'Education',
      want: target.preferredEducation,
      ok: !viewer.education ? null : looseMatch(target.preferredEducation, viewer.education),
      freeText: true,
    });
  }

  if (target.preferredProfession) {
    checks.push({
      label: 'Profession',
      want: target.preferredProfession,
      ok: !viewer.profession ? null : looseMatch(target.preferredProfession, viewer.profession),
      freeText: true,
    });
  }

  const cities = (target.preferredCity ?? []).filter(Boolean);
  if (cities.length > 0) {
    checks.push({
      label: 'City',
      want: cities.join(', '),
      ok: !viewer.city ? null : cities.some((cty) => looseMatch(cty, viewer.city)),
      freeText: true,
    });
  }

  return checks;
};

interface PreferenceMatchProps {
  target: Profile;
  viewer: Profile | undefined;
  targetName?: string;
}

const verdict = (ok: boolean | null) =>
  ok === true ? 'You match' : ok === false ? 'Not a match' : 'Not on your profile yet';

/**
 * Renders nothing until both profiles are in: this is a secondary read, so a
 * missing viewer profile (still loading or failed) omits the card rather than
 * blocking the screen behind it.
 */
export default function PreferenceMatch({ target, viewer, targetName = 'them' }: PreferenceMatchProps) {
  const { c, elder } = useTheme();
  const { fontScale } = useWindowDimensions();
  const checks = buildPreferenceChecks(target, viewer);
  if (checks.length === 0) return null;
  // The label column is a fixed 84pt. Past this much text scaling (or in elder
  // mode) "Profession" no longer fits it, so the label stacks above its value.
  const stacked = fontScale > 1.15 || elder;

  const scored = checks.filter((ch) => ch.ok !== null);
  const matched = scored.filter((ch) => ch.ok).length;
  const allMatched = scored.length > 0 && matched === scored.length;

  const chipBg = allMatched ? c.successBg : matched > 0 ? c.accentSoft : c.surface2;
  // successAccent is the pair that stays legible on a dark surface; `success` is not.
  const chipFg = allMatched ? c.successAccent : matched > 0 ? c.primary : c.textSecondary;
  const summary = scored.length > 0 ? `${matched} of ${scored.length} match` : 'Add your details to compare';

  return (
    <Card padded={false} style={styles.card}>
      <View
        style={[styles.header, { borderBottomColor: c.border }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`Do you fit what ${targetName} is looking for? ${summary}`}
      >
        <View style={[styles.iconTile, { backgroundColor: c.accentSoft }]}>
          <Ionicons
            name="heart"
            size={15}
            color={c.primary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
        <Text variant="subhead" color="fgStrong" style={styles.title} numberOfLines={2}>
          Do you fit what {targetName} is looking for?
        </Text>
        {scored.length > 0 && (
          <View style={[styles.chip, { backgroundColor: chipBg }]}>
            {/* chipFg picks between c.successAccent/c.primary/c.textSecondary at runtime — left as a style override per the dynamic-colour rule */}
            <Text variant="caption" style={{ color: chipFg }}>{matched}/{scored.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {checks.map(({ label, want, ok, freeText }, i) => (
          <View
            key={label}
            style={[styles.row, i < checks.length - 1 && { borderBottomColor: c.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}
            accessible
            accessibilityLabel={`${label}: ${want}. ${verdict(ok)}`}
          >
            <View
              style={[styles.statusDot, { backgroundColor: ok === true ? c.successBg : c.surface2 }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons
                name={ok === true ? 'checkmark' : ok === false ? 'close' : 'remove'}
                size={13}
                color={ok === true ? c.successAccent : c.textMuted}
              />
            </View>
            <View style={[styles.textWrap, stacked ? styles.textStacked : styles.textInline]}>
              <Text
                variant="caption"
                color="textSecondary"
                style={stacked ? undefined : styles.label}
                numberOfLines={1}
                maxScale={1.3}
              >
                {label}
              </Text>
              <View style={stacked ? undefined : styles.wantCol}>
                <Text variant="subhead" color="textPrimary" style={freeText ? styles.capitalize : undefined}>
                  {want}
                </Text>
                {ok === null && <Text variant="footnote" color="textSecondary">Add yours to compare</Text>}
              </View>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1 },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  body: { paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  statusDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  textInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  textStacked: { flexDirection: 'column', gap: 2 },
  label: { width: 84 },
  wantCol: { flex: 1 },
  capitalize: { textTransform: 'capitalize' },
});
