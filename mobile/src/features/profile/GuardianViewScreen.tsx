import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { EmptyState, ScreenHeader } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import SmartImage from '../../components/common/SmartImage';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getGuardianMatches, getGuardianShortlist } from '../../api/guardian';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { ProfileSummary } from '../../types';
import { LIST_PERF } from '../../constants/listPerf';

type Route = RouteProp<MainStackParamList, 'GuardianView'>;

type TabKey = 'matches' | 'shortlisted';

// Decorative glyphs sit beside a text label; the screen reader reads the label.
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

// ─── Age helper ───────────────────────────────────────────────────────────────

function ageFromDob(dob: string | null | undefined): string {
  if (!dob) return '';
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(age) ? `${age} yrs` : '';
}

// ─── Read-only profile card ───────────────────────────────────────────────────
// Deliberately NOT pressable. The guardian API sends a name and a city and
// nothing else, and ProfileDetail has no guardian mode: tapping through would
// land on the full interactive profile (Like, Shortlist, Message, unlock) acting
// as the guardian's OWN member account, which is exactly what "read-only" says
// it cannot do. A guardian-mode ProfileDetail is a product decision.

interface ROCardProps {
  profile: ProfileSummary;
}

function ReadOnlyProfileCard({ profile }: ROCardProps) {
  const { c } = useTheme();
  const rc = React.useMemo(() => makeRc(c), [c]);
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const photo = profile.photos?.[0];
  const details = [ageFromDob(profile.dateOfBirth), profile.city, profile.profession].filter(Boolean).join(' · ');

  return (
    // One element to a screen reader: name and details read together.
    <View
      style={rc.card}
      testID={`ro-card-${profile.id}`}
      accessible
      accessibilityLabel={details ? `${name}, ${details}` : name}
    >
      {/* Initials fallback when there is no photo (the guardian API sends none today). */}
      <SmartImage uri={photo} name={name} style={rc.photo} initialSize={24} />
      <View style={rc.info}>
        <Text variant="headline" color="textPrimary" numberOfLines={1}>{name}</Text>
        {details ? <Text variant="footnote" color="textSecondary" numberOfLines={2}>{details}</Text> : null}
        {profile.education && <Text variant="footnote" color="textSecondary" numberOfLines={1}>{profile.education}</Text>}
        {profile.compatibilityScore != null && (
          <View style={rc.compatRow}>
            <Ionicons name="heart" size={12} color={c.primary} {...HIDE_FROM_A11Y} />
            <Text variant="caption" color="primary">{profile.compatibilityScore}% match</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const makeRc = (c: ThemeColours) => StyleSheet.create({
  card:            { flexDirection: 'row', alignItems: 'center', backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border, padding: spacing.md, gap: spacing.md },
  photo:           { width: 64, height: 64, borderRadius: borderRadius.md },
  info:            { flex: 1, gap: 3 },
  compatRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GuardianViewScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const route = useRoute<Route>();
  const { candidateId, candidateName } = route.params;

  const [activeTab, setActiveTab] = useState<TabKey>('matches');

  const matchesQuery = useQuery({
    queryKey: queryKeys.guardianMatches(candidateId),
    queryFn: () => getGuardianMatches(candidateId),
    staleTime: 2 * 60 * 1000,
    enabled: activeTab === 'matches',
  });

  const shortlistQuery = useQuery({
    queryKey: queryKeys.guardianShortlist(candidateId),
    queryFn: () => getGuardianShortlist(candidateId),
    staleTime: 2 * 60 * 1000,
    enabled: activeTab === 'shortlisted',
  });

  const activeQuery = activeTab === 'matches' ? matchesQuery : shortlistQuery;
  const profiles: ProfileSummary[] = activeQuery.data?.profiles ?? [];

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'matches',     label: 'Mutual matches' },
    { key: 'shortlisted', label: 'Shortlisted' },
  ];

  return (
    <Screen edges={['top', 'bottom']} style={s.wrapper} testID="GuardianViewScreen">
      <ScreenHeader title={candidateName} subtitle="Guardian view" testID="guardian-view-header" />

      {/* Read-only banner */}
      <View style={s.readOnlyBanner}>
        <Ionicons name="eye-outline" size={14} color={c.primary} {...HIDE_FROM_A11Y} />
        <Text variant="footnote" color="primary" style={s.readOnlyText}>
          Read-only. You can see the names and cities of {candidateName}'s matches, but cannot act on them.
        </Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar} accessibilityRole="tablist">
        {TABS.map((tab) => (
          <PressableScale
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            testID={`tab-${tab.key}`}
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {/* textSecondary, not textMuted: the inactive label is a control and fails AA in muted grey. */}
            <Text variant="subhead" color={activeTab === tab.key ? 'primary' : 'textSecondary'} style={s.tabLabel}>{tab.label}</Text>
          </PressableScale>
        ))}
      </View>

      {/* Content */}
      {activeQuery.isLoading ? (
        <ListSkeleton rows={6} />
      ) : activeQuery.isError && !activeQuery.data ? (
        <View style={s.errorState}>
          <EmptyState
            variant="error"
            icon="cloud-offline-outline"
            title={activeTab === 'matches' ? "Couldn't load matches" : "Couldn't load shortlist"}
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => activeQuery.refetch()}
            testID="GuardianViewScreen-error"
          />
        </View>
      ) : (
        <FlatList
          {...LIST_PERF}
          data={profiles}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <ReadOnlyProfileCard profile={item} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={activeQuery.isFetching && !activeQuery.isLoading}
              onRefresh={() => activeQuery.refetch()}
              tintColor={c.primary}
              colors={[c.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={activeTab === 'matches' ? 'heart-outline' : 'bookmark-outline'}
              title={activeTab === 'matches' ? 'No mutual matches yet' : 'No shortlisted profiles'}
              description={
                activeTab === 'matches'
                  ? `${candidateName} has no mutual matches yet.`
                  : `${candidateName} hasn't shortlisted anyone yet.`
              }
              actionLabel="Refresh"
              onAction={() => activeQuery.refetch()}
              testID="GuardianViewScreen-empty"
            />
          }
        />
      )}
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:       { backgroundColor: c.background },
  readOnlyBanner:{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: c.primaryLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  readOnlyText:  { flex: 1 },
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background },
  // minHeight, not height: a longer hi/pa label or a bigger OS text size must grow the tab.
  tab:           { flex: 1, minHeight: 48, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: c.primary },
  tabLabel:      { textAlign: 'center' },
  errorState:    { flex: 1, justifyContent: 'center' },
});
