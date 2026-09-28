import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet } from 'react-native';
import Text from '../../components/ui/Text';
import { LegalLayout, Section, Para } from './LegalLayout';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';

// Mirrors frontend/src/pages/About.jsx. The four "stats" are statements, not
// numbers, on purpose: this screen used to print 1,190+ marriages, 50K+
// verified members, a 92% reply rate and "Since 2011", none of which were
// true. A member count you do not have is worse than none; do not put a
// figure back here unless it is read from the server.
const STATS = [
  { value: 'Live selfie', label: 'Verification, never uploads' },
  { value: 'Tricity only', label: 'Chandigarh · Mohali · Panchkula' },
  { value: 'Family-first', label: 'Guardians participate gracefully' },
  { value: 'Founding', label: 'Members join free' },
];

// No index numerals beside these: a numbered list of principles is a section-number
// pattern (doctrine 8), and the order carries no meaning.
const VALUES = [
  { t: 'Verified profiles', d: 'The verified badge is earned with a live selfie matched by human review, never a file upload.' },
  { t: 'Privacy-first', d: 'Your data is yours. Browse incognito, control who sees you, numbers never shared.' },
  { t: 'Family-oriented', d: 'Matching that respects family background, values, and the people who matter in the decision.' },
  { t: 'Hyperlocal focus', d: 'Built only for Chandigarh, Mohali and Panchkula. Partners within driving distance.' },
  { t: 'Transparent pricing', d: 'Clear plans, no hidden fees, no surprise renewals. Free to start.' },
  { t: 'Human-reviewed', d: 'A person, not an algorithm, reviews every verification selfie and every report.' },
];

export default function AboutScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <LegalLayout title="About us" subtitle="Chandigarh, Mohali and Panchkula">
      <Section>
        <Para>
          TricityMatch is a hyperlocal matrimonial platform built specifically for families in
          Chandigarh, Mohali and Panchkula, where finding a life partner is meaningful, safe and
          community-first. Matrimony built for families, not algorithms.
        </Para>
      </Section>

      <View style={s.statsGrid}>
        {STATS.map((st) => (
          <View key={st.label} style={s.statCard}>
            <Text variant="title2" color="primary">{st.value}</Text>
            <Text variant="subhead" color="textSecondary" style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      <Section heading="What we stand for">
        <Para>Six principles that shape every decision.</Para>
        {VALUES.map((v) => (
          <View key={v.t} style={s.valueRow}>
            <Text variant="headline" color="textPrimary">{v.t}</Text>
            <Text variant="subhead" color="textSecondary" style={s.valueDesc}>{v.d}</Text>
          </View>
        ))}
      </Section>
    </LegalLayout>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard:   { flexBasis: '47%', flexGrow: 1, backgroundColor: c.surfaceCard, borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  statLabel:  { marginTop: 2 },
  valueRow:   { marginTop: spacing.md },
  valueDesc:  { marginTop: 2 },
});
