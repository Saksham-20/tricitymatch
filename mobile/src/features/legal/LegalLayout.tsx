import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Text from '../../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, spacing, type ThemeColours } from '@shared/constants/theme';

// Shared shell for the static content screens (Terms / Privacy / About /
// Safety). Mirrors the website's legal pages in native form.
export function LegalLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const navigation = useNavigation();
  return (
    <SafeAreaView style={s.wrapper}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text variant="headline" color="textPrimary" style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text variant="title1" color="textPrimary" style={s.title}>{title}</Text>
        {subtitle ? <Text variant="subhead" color="textSecondary" style={s.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({ heading, children }: { heading?: string; children: React.ReactNode }) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <View style={s.section}>
      {heading ? <Text variant="headline" color="textPrimary" style={s.heading}>{heading}</Text> : null}
      {children}
    </View>
  );
}

export function Para({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return <Text variant="callout" color="textSecondary" style={s.para}>{children}</Text>;
}

export function Bullet({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <View style={s.bulletRow}>
      <Text variant="callout" color="primary" style={s.bulletDot}>•</Text>
      <Text variant="callout" color="textSecondary" style={s.bulletText}>{children}</Text>
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:     { flex: 1, backgroundColor: c.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  back:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  content:     { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  title:       { marginBottom: spacing.xs },
  subtitle:    { marginBottom: spacing.lg },
  section:     { marginBottom: spacing.lg },
  heading:     { marginBottom: spacing.xs },
  para:        { marginBottom: spacing.sm },
  bulletRow:   { flexDirection: 'row', marginBottom: spacing.xs, paddingRight: spacing.sm },
  bulletDot:   { marginRight: spacing.sm },
  bulletText:  { flex: 1 },
});
