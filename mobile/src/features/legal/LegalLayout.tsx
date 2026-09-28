import React from 'react';
import { Linking, View, StyleSheet, ScrollView } from 'react-native';
import Text from '../../components/ui/Text';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Screen from '../../components/layout/Screen';
import { showToast } from '../../utils/toast';
import { spacing } from '@shared/constants/theme';

// Shared shell for the static content screens (Terms / Privacy / About /
// Safety). Mirrors the website's legal pages in native form.
//
// The title lives in the header only. It used to be drawn twice (a small
// header title, then a big one at the top of the body) two lines apart.
export function LegalLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={title} subtitle={subtitle} />
      <ScrollView contentContainerStyle={layout.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </Screen>
  );
}

export function Section({ heading, children }: { heading?: string; children: React.ReactNode }) {
  return (
    <View style={layout.section}>
      {heading ? (
        <Text variant="headline" color="textPrimary" style={layout.heading} accessibilityRole="header">{heading}</Text>
      ) : null}
      {children}
    </View>
  );
}

// A support address or a tricitymatch.com page named in the policy text must be
// something a member can open or copy: a policy that says "write to X" or "see
// tricitymatch.com/delete-account" in dead grey text sends them off to retype it.
const LINK_RE = /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b|\btricitymatch\.com(?:\/[A-Za-z0-9\-_./]*[A-Za-z0-9\-_/])?)/g;

const openLink = (target: string) => {
  const url = target.includes('@') ? `mailto:${target}` : `https://${target}`;
  Linking.openURL(url).catch(() => showToast.info('Could not open the link', target));
};

/** Splits plain-string children into text + tappable links; anything else passes through. */
function linkify(children: React.ReactNode): { nodes: React.ReactNode; hasLink: boolean } {
  let hasLink = false;
  const nodes = React.Children.map(children, (child, i) => {
    if (typeof child !== 'string') return child;
    const parts = child.split(LINK_RE);
    if (parts.length === 1) return child;
    hasLink = true;
    return parts.map((part, j) =>
      j % 2 === 1 ? (
        <Text
          key={`${i}-${j}`}
          variant="callout"
          color="primary"
          style={layout.link}
          accessibilityRole="link"
          onPress={() => openLink(part)}
        >
          {part}
        </Text>
      ) : (
        part
      ),
    );
  });
  return { nodes, hasLink };
}

// `selectable` lets a member copy an address, a date or a clause out of the
// policy. A paragraph that carries a link is left non-selectable: a nested
// onPress inside a selectable Text is unreliable on Android, and the link
// itself is the copyable thing (it opens the mail app or the page).
export function Para({ children }: { children: React.ReactNode }) {
  const { nodes, hasLink } = linkify(children);
  return <Text variant="callout" color="textSecondary" style={layout.para} selectable={!hasLink}>{nodes}</Text>;
}

export function Bullet({ children }: { children: React.ReactNode }) {
  const { nodes, hasLink } = linkify(children);
  return (
    <View style={layout.bulletRow}>
      {/* The dot is typography, not content: hide it so a screen reader does not say "bullet". */}
      <Text
        variant="callout"
        color="primary"
        style={layout.bulletDot}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        •
      </Text>
      <Text variant="callout" color="textSecondary" style={layout.bulletText} selectable={!hasLink}>{nodes}</Text>
    </View>
  );
}

// Layout only, no colour (colour arrives through the Text primitive), so this
// can live at module scope: a policy page renders ~80 Bullets, and each one
// used to build its own full StyleSheet.
const layout = StyleSheet.create({
  content:     { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  section:     { marginBottom: spacing.lg },
  heading:     { marginBottom: spacing.xs },
  para:        { marginBottom: spacing.sm },
  bulletRow:   { flexDirection: 'row', marginBottom: spacing.xs, paddingRight: spacing.sm },
  bulletDot:   { marginRight: spacing.sm },
  bulletText:  { flex: 1 },
  // Colour arrives through the Text primitive; only the underline is set here.
  link:        { textDecorationLine: 'underline' },
});
