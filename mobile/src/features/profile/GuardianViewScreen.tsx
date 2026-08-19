import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
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
    <TouchableOpacity style={rc.card} onPress={onPress} testID={`ro-card-${profile.id}`} accessibilityLabel={`View ${name}`}>
      {photo ? (
        <Image source={{ uri: photo }} style={rc.photo} resizeMode="cover" />
      ) : (
        <View style={[rc.photo, rc.photoPlaceholder]}>
          <Ionicons name="person" size={32} color={c.textMuted} />
        </View>
      )}
      <View style={rc.info}>
        <Text style={rc.name}>{name}</Text>
        <Text style={rc.sub}>
          {[ageFromDob(profile.dateOfBirth), profile.city, profile.profession].filter(Boolean).join(' · ')}
        </Text>
        {profile.education && <Text style={rc.detail}>{profile.education}</Text>}
        {profile.compatibilityScore != null && (
          <View style={rc.compatRow}>
            <Ionicons name="heart" size={12} color={c.primary} />
            <Text style={rc.compatText}>{profile.compatibilityScore}% match</Text>
          </View>
        )}
      </View>
      {/* Read-only badge — no action buttons */}
      <View style={rc.viewOnlyBadge}>
        <Text style={rc.viewOnlyText}>View Only</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </TouchableOpacity>
  );
}

const makeRc = (c: ThemeColours) => StyleSheet.create({
  card:            { flexDirection: 'row', alignItems: 'center', backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border, padding: spacing.md, gap: spacing.md },
  photo:           { width: 64, height: 64, borderRadius: borderRadius.md },
  photoPlaceholder:{ backgroundColor: c.surfaceCard, alignItems: 'center', justifyContent: 'center' },
  info:            { flex: 1, gap: 3 },
  name:            { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: c.textPrimary },
  sub:             { fontSize: typography.fontSize.sm, color: c.textSecondary },
  detail:          { fontSize: typography.fontSize.xs, color: c.textMuted },
  compatRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  compatText:      { fontSize: typography.fontSize.xs, color: c.primary, fontFamily: typography.fontFamily.medium },
  viewOnlyBadge:   { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: c.border, borderRadius: borderRadius.full },
  viewOnlyText:    { fontSize: 10, color: c.textMuted },
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerTitle}>
          <Text style={s.title}>{candidateName}</Text>
          <Text style={s.titleSub}>Guardian View</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Read-only banner */}
      <View style={s.readOnlyBanner}>
        <Ionicons name="eye-outline" size={14} color={c.primary} style={{ marginRight: 4 }} />
        <Text style={s.readOnlyText}>Read-only · You can browse but not take any actions</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            testID={`tab-${tab.key}`}
            accessibilityLabel={tab.label}
          >
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeQuery.isLoading ? (
        <ListSkeleton rows={6} />
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
              <Text style={s.emptyTitle}>
                {activeTab === 'matches' ? 'No Mutual Matches Yet' : 'No Shortlisted Profiles'}
              </Text>
              <Text style={s.emptyHint}>
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
  title:         { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: c.textPrimary },
  titleSub:      { fontSize: typography.fontSize.xs, color: c.textSecondary },
  readOnlyBanner:{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.primaryLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  readOnlyText:  { fontSize: typography.fontSize.xs, color: c.primary },
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background },
  tab:           { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: c.primary },
  tabLabel:      { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: c.textMuted },
  tabLabelActive:{ color: c.primary, fontFamily: typography.fontFamily.semiBold },
  emptyState:    { alignItems: 'center', gap: spacing.md, paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyTitle:    { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.semiBold, color: c.textSecondary },
  emptyHint:     { fontSize: typography.fontSize.sm, color: c.textMuted, textAlign: 'center' },
});
