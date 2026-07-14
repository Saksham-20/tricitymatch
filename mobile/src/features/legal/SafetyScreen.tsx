import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LegalLayout, Section, Para, Bullet } from './LegalLayout';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

// Mirrors frontend/src/pages/Safety.jsx
export default function SafetyScreen() {
  return (
    <LegalLayout title="Safety & Trust" subtitle="Your trust comes first">
      <View style={s.emergency}>
        <Text style={s.emergencyText}>In immediate danger? Call 112.</Text>
      </View>

      <Section>
        <Para>
          We do the groundwork on verification and privacy so you can focus on finding the right
          person. Here's how we keep the platform — and you — safe.
        </Para>
      </Section>

      <Section heading="01 · Profile verification">
        <Para>Every profile passes selfie verification — a live photo matched to their profile pictures by our safety team — before going live. Verified profiles display a badge and receive 3× more responses; always prefer them when connecting.</Para>
      </Section>

      <Section heading="02 · Safe messaging">
        <Bullet>Never share financial information in chats</Bullet>
        <Bullet>Don't send money to anyone you haven't met in person</Bullet>
        <Bullet>Be cautious of anyone rushing you off-platform</Bullet>
        <Bullet>Report suspicious behaviour with the Report button</Bullet>
      </Section>

      <Section heading="03 · Meeting safely">
        <Bullet>Meet first in a public place, with family or friends</Bullet>
        <Bullet>Tell a trusted person your plans before meeting</Bullet>
        <Bullet>Don't share your home address until you're comfortable</Bullet>
      </Section>

      <Section heading="04 · Reporting & blocking">
        <Para>Use Report and Block on any profile. Reports are reviewed by our safety team within 24 hours. Blocked users cannot view your profile or contact you.</Para>
      </Section>
    </LegalLayout>
  );
}

const s = StyleSheet.create({
  emergency:     { backgroundColor: colours.error + '15', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colours.error + '40', padding: spacing.md, marginBottom: spacing.lg },
  emergencyText: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.error, textAlign: 'center' },
});
