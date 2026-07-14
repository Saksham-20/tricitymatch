import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, typography, spacing } from '@shared/constants/theme';

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
  const navigation = useNavigation();
  return (
    <SafeAreaView style={s.wrapper}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({ heading, children }: { heading?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      {heading ? <Text style={s.heading}>{heading}</Text> : null}
      {children}
    </View>
  );
}

export function Para({ children }: { children: React.ReactNode }) {
  return <Text style={s.para}>{children}</Text>;
}

export function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:     { flex: 1, backgroundColor: colours.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colours.border },
  back:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  content:     { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  title:       { fontSize: typography.fontSize['3xl'], fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.xs },
  subtitle:    { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginBottom: spacing.lg },
  section:     { marginBottom: spacing.lg },
  heading:     { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.xs },
  para:        { fontSize: typography.fontSize.base, color: colours.textSecondary, lineHeight: 22, marginBottom: spacing.sm },
  bulletRow:   { flexDirection: 'row', marginBottom: spacing.xs, paddingRight: spacing.sm },
  bulletDot:   { fontSize: typography.fontSize.base, color: colours.primary, marginRight: spacing.sm, lineHeight: 22 },
  bulletText:  { flex: 1, fontSize: typography.fontSize.base, color: colours.textSecondary, lineHeight: 22 },
});
