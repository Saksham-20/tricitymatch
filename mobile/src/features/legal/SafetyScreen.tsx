import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { StyleSheet, View } from 'react-native';
import Text from '../../components/ui/Text';
import { LegalLayout, Section, Para, Bullet } from './LegalLayout';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';

// Mirrors frontend/src/pages/Safety.jsx
export default function SafetyScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <LegalLayout title="Safety and trust" subtitle="Your trust comes first">
      <View style={s.emergency}>
        <Text variant="headline" color="error" style={s.emergencyText}>In immediate danger? Call 112.</Text>
      </View>

      <Section>
        <Para>
          We do the groundwork on verification and privacy so you can focus on finding the right
          person. Here's how we keep the platform, and you, safe.
        </Para>
      </Section>

      <Section heading="Profile verification">
        <Para>The verified badge is earned, not assumed: a member captures a live selfie in-app, and our safety team matches it to their profile pictures by hand. Verified profiles carry the badge and can be filtered for. Always prefer them when connecting.</Para>
      </Section>

      <Section heading="Safe messaging">
        <Bullet>Never share financial information in chats</Bullet>
        <Bullet>Don't send money to anyone you haven't met in person</Bullet>
        <Bullet>Be cautious of anyone rushing you off-platform</Bullet>
        <Bullet>Report suspicious behaviour with the Report button</Bullet>
      </Section>

      <Section heading="Meeting safely">
        <Bullet>Meet first in a public place, with family or friends</Bullet>
        <Bullet>Tell a trusted person your plans before meeting</Bullet>
        <Bullet>Don't share your home address until you're comfortable</Bullet>
      </Section>

      <Section heading="Reporting and blocking">
        <Para>Use Report and Block on any profile. Reports are reviewed by our safety team within 24 hours. Blocked users cannot view your profile or contact you.</Para>
      </Section>
    </LegalLayout>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  emergency:     { backgroundColor: c.error + '15', borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.error + '40', padding: spacing.md, marginBottom: spacing.lg },
  emergencyText: { textAlign: 'center' },
});
