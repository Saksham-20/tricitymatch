import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import Text from '../../components/ui/Text';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { EmptyState } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { useTranslation } from 'react-i18next';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getGuardianMatches, getGuardianShortlist } from '../../api/guardian';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { ProfileSummary } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'GuardianView'>;

type TabKey = 'matches' | 'shortlisted';

// ─── Age helper ───────────────────────────────────────────────────────────────

function ageFromDob(dob: string | null): string {
  if (!dob) return '';
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${age} yrs`;
}

// ─── Read-only profile card ───────────────────────────────────────────────────

interface ROCardProps {
  profile: ProfileSummary;
  onPress: () => void;
}

function ReadOnlyProfileCard({ profile, onPress }: ROCardProps) {
  const { c } = useTheme();
  const rc = React.useMemo(() => makeRc(c), [c]);
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const photo = profile.photos?.[0];

  return (
    <PressableScale
      style={rc.card}
      onPress={onPress}
      testID={`ro-card-${profile.id}`}
      accessibilityLabel={`View ${name}`}
      accessibilityRole="button"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={rc.photo} resizeMode="cover" />
      ) : (
        <View style={[rc.photo, rc.photoPlaceholder]}>
          <Ionicons name="person" size={32} color={c.textMuted} />
        </View>
      )}
      <View style={rc.info}>
        <Text variant="headline" color="textPrimary">{name}</Text>
        <Text variant="footnote" color="textSecondary">
          {[ageFromDob(profile.dateOfBirth), profile.city, profile.profession].filter(Boolean).join(' · ')}
        </Text>
        {profile.education && <Text variant="footnote" color="textMuted">{profile.education}</Text>}
        {profile.compatibilityScore != null && (
          <View style={rc.compatRow}>
            <Ionicons name="heart" size={12} color={c.primary} />
            <Text variant="caption" color="primary">{profile.compatibilityScore}% match</Text>
          </View>
        )}
      </View>
      {/* Read-only badge — no action buttons */}
      <View style={rc.viewOnlyBadge}>
        <Text variant="micro" color="textMuted">View Only</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </PressableScale>
  );
}

const makeRc = (c: ThemeColours) => StyleSheet.create({
  card:            { flexDirection: 'row', alignItems: 'center', backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border, padding: spacing.md, gap: spacing.md },
  photo:           { width: 64, height: 64, borderRadius: borderRadius.md },
  photoPlaceholder:{ backgroundColor: c.surfaceCard, alignItems: 'center', justifyContent: 'center' },
  info:            { flex: 1, gap: 3 },
  compatRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  viewOnlyBadge:   { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: c.border, borderRadius: borderRadius.full },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GuardianViewScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
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

  const handleViewProfile = (userId: string) => {
    navigation.navigate('ProfileDetail', { userId });
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'matches',     label: 'Mutual Matches' },
    { key: 'shortlisted', label: 'Shortlisted' },
  ];

  return (
    <View style={s.wrapper} testID="GuardianViewScreen">
      {/* Header */}
      <View style={s.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          testID="back-btn"
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <View style={s.headerTitle}>
          <Text variant="headline" color="textPrimary">{candidateName}</Text>
          <Text variant="footnote" color="textSecondary">Guardian View</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Read-only banner */}
      <View style={s.readOnlyBanner}>
        <Ionicons name="eye-outline" size={14} color={c.primary} style={{ marginRight: 4 }} />
        <Text variant="footnote" color="primary">Read-only · You can browse but not take any actions</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
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
            <Text variant="subhead" color={activeTab === tab.key ? 'primary' : 'textMuted'}>{tab.label}</Text>
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
          data={profiles}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <ReadOnlyProfileCard profile={item} onPress={() => handleViewProfile(item.id)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={activeQuery.isFetching && !activeQuery.isLoading}
              onRefresh={() => activeQuery.refetch()}
              tintColor={c.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name={activeTab === 'matches' ? 'heart-outline' : 'bookmark-outline'} size={48} color={c.textMuted} />
              <Text variant="title3" color="textSecondary">
                {activeTab === 'matches' ? 'No Mutual Matches Yet' : 'No Shortlisted Profiles'}
              </Text>
              <Text variant="footnote" color="textMuted" style={s.emptyHint}>
                {activeTab === 'matches'
                  ? `${candidateName} has no mutual matches yet.`
                  : `${candidateName} hasn't shortlisted anyone yet.`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:       { flex: 1, backgroundColor: c.background },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { alignItems: 'center' },
  readOnlyBanner:{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.primaryLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background },
  tab:           { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: c.primary },
  errorState:    { flex: 1, justifyContent: 'center' },
  emptyState:    { alignItems: 'center', gap: spacing.md, paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyHint:     { textAlign: 'center' },
});
