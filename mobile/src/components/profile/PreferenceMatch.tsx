import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type, spacing, borderRadius } from '@shared/constants/theme';
import type { Profile } from '../../types';
import { useTheme } from '../../hooks/useTheme';

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

interface Check {
  label: string;
  want: string;
  ok: boolean | null;
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
      want: `${min ?? '—'} – ${max ?? '—'} yrs`,
      ok: age == null ? null : (!min || age >= min) && (!max || age <= max),
    });
  }

  if (target.preferredHeightMin || target.preferredHeightMax) {
    const h = viewer.height;
    const min = target.preferredHeightMin;
    const max = target.preferredHeightMax;
    checks.push({
      label: 'Height',
      want: `${min ? cmToFeet(min) : '—'} – ${max ? cmToFeet(max) : '—'}`,
      ok: !h ? null : (!min || h >= min) && (!max || h <= max),
    });
  }

  if (target.preferredEducation) {
    checks.push({
      label: 'Education',
      want: target.preferredEducation,
      ok: !viewer.education ? null : looseMatch(target.preferredEducation, viewer.education),
    });
  }

  if (target.preferredProfession) {
    checks.push({
      label: 'Profession',
      want: target.preferredProfession,
      ok: !viewer.profession ? null : looseMatch(target.preferredProfession, viewer.profession),
    });
  }

  const cities = (target.preferredCity ?? []).filter(Boolean);
  if (cities.length > 0) {
    checks.push({
      label: 'City',
      want: cities.join(', '),
      ok: !viewer.city ? null : cities.some((cty) => looseMatch(cty, viewer.city)),
    });
  }

  return checks;
};

interface PreferenceMatchProps {
  target: Profile;
  viewer: Profile | undefined;
  targetName?: string;
}

export default function PreferenceMatch({ target, viewer, targetName = 'them' }: PreferenceMatchProps) {
  const { c } = useTheme();
  const checks = buildPreferenceChecks(target, viewer);
  if (checks.length === 0) return null;

  const scored = checks.filter((ch) => ch.ok !== null);
  const matched = scored.filter((ch) => ch.ok).length;
  const allMatched = scored.length > 0 && matched === scored.length;

  const chipBg = allMatched ? c.successBg : matched > 0 ? c.accentSoft : c.surface2;
  const chipFg = allMatched ? c.success : matched > 0 ? c.primary : c.textMuted;

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.border }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={[styles.iconTile, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="heart" size={15} color={c.primary} />
        </View>
        <Text style={[styles.title, { color: c.fgStrong }]} numberOfLines={2}>
          Do you fit what {targetName} is looking for?
        </Text>
        {scored.length > 0 && (
          <View style={[styles.chip, { backgroundColor: chipBg }]}>
            <Text style={[styles.chipText, { color: chipFg }]}>{matched}/{scored.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {checks.map(({ label, want, ok }, i) => (
          <View
            key={label}
            style={[styles.row, i < checks.length - 1 && { borderBottomColor: c.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: ok === true ? c.successBg : ok === false ? c.surface2 : c.surface2 },
              ]}
            >
              <Ionicons
                name={ok === true ? 'checkmark' : ok === false ? 'close' : 'remove'}
                size={13}
                color={ok === true ? c.success : ok === false ? c.textMuted : c.textMuted}
              />
            </View>
            <Text style={[styles.label, { color: c.textMuted }]} numberOfLines={1}>{label}</Text>
            <Text style={[styles.want, { color: c.textPrimary }]} numberOfLines={1}>
              {want}
            </Text>
            {ok === null && <Text style={[styles.hint, { color: c.textMuted }]}>add yours</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
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
  title: { ...type.caption, flex: 1, letterSpacing: 0.3 },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  chipText: { ...type.caption },
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
  label: { ...type.caption, width: 84, textTransform: 'uppercase', letterSpacing: 0.3 },
  want: { ...type.subhead, flex: 1, textTransform: 'capitalize' },
  hint: { ...type.footnote },
});
