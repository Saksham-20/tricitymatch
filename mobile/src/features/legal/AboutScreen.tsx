import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LegalLayout, Section, Para } from './LegalLayout';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

// Mirrors frontend/src/pages/About.jsx
const STATS = [
  { value: '1,190+', label: 'Marriages made' },
  { value: '50K+', label: 'Verified members' },
  { value: '92%', label: 'Reply within 48 hrs' },
  { value: '15 yr', label: 'Serving Tricity families' },
];

const VALUES = [
  { n: '01', t: 'Verified, every profile', d: 'Selfie verification and human review before any profile goes live. Zero fake accounts, zero exceptions.' },
  { n: '02', t: 'Privacy-first', d: 'Your data is yours. Browse incognito, control who sees you, numbers never shared.' },
  { n: '03', t: 'Family-oriented', d: 'Matching that respects family background, values, and the people who matter in the decision.' },
  { n: '04', t: 'Hyperlocal focus', d: 'Built only for Chandigarh, Mohali and Panchkula. Partners within driving distance.' },
  { n: '05', t: 'Transparent pricing', d: 'Clear plans, no hidden fees, no surprise renewals. Free to start.' },
  { n: '06', t: 'Human-reviewed', d: 'A real safety team reviews profiles and reports — not just an algorithm.' },
];

export default function AboutScreen() {
  return (
    <LegalLayout title="About Us" subtitle="Our story · Tricity only · Since 2011">
      <Section>
        <Para>
          TricityShadi is a hyperlocal matrimonial platform built specifically for families in
          Chandigarh, Mohali and Panchkula — where finding a life partner is meaningful, safe and
          community-first. Matrimony built for families, not algorithms.
        </Para>
      </Section>

      <View style={s.statsGrid}>
        {STATS.map((st) => (
          <View key={st.label} style={s.statCard}>
            <Text style={s.statValue}>{st.value}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      <Section heading="What we stand for">
        <Para>Six principles that shape every decision.</Para>
        {VALUES.map((v) => (
          <View key={v.n} style={s.valueRow}>
            <Text style={s.valueNum}>{v.n}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.valueTitle}>{v.t}</Text>
              <Text style={s.valueDesc}>{v.d}</Text>
            </View>
          </View>
        ))}
      </Section>
    </LegalLayout>
  );
}

const s = StyleSheet.create({
  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard:   { flexBasis: '47%', flexGrow: 1, backgroundColor: colours.surfaceCard, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colours.border, padding: spacing.md },
  statValue:  { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: colours.primary },
  statLabel:  { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginTop: 2 },
  valueRow:   { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  valueNum:   { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.bold, color: colours.primary, width: 28 },
  valueTitle: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  valueDesc:  { fontSize: typography.fontSize.sm, color: colours.textSecondary, lineHeight: 20, marginTop: 2 },
});
