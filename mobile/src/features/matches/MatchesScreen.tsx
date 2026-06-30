import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import SmartImage from '../../components/common/SmartImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, type, spacing, borderRadius } from '@shared/constants/theme';
import {
  getMutualMatches,
  getShortlisted,
  getLikedMe,
  performMatchAction,
} from '../../api/matches';
import { queryKeys } from '../../constants/queryKeys';
import { useOfflineShortlist } from '../../hooks/useOfflineShortlist';
import OfflineBanner from '../../components/common/OfflineBanner';
import { Avatar, EmptyState as SharedEmpty, GoldLock, SkeletonRow, MatchCelebration } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import type { MainStackParamList } from '../../navigation/types';
import type { Match, MatchAction } from '../../types';
import { useAuthStore, selectPlan } from '../../stores/authStore';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type TabKey = 'mutual' | 'shortlisted' | 'liked_me';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'mutual',      label: 'Mutual' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'liked_me',    label: 'Liked Me' },
];

const scoreColour = (p: number) => (p >= 90 ? colours.success : p >= 75 ? colours.g500 : colours.p500);

// ─── Match Row (shared list item) ─────────────────────────────────────────────

interface MatchRowProps {
  match: Match;
  mode: TabKey;
  onPress: () => void;
  onChat?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onRemove?: () => void;
}

function MatchRow({ match, mode, onPress, onChat, onAccept, onDecline, onRemove }: MatchRowProps) {
  const { c } = useTheme();
  const profile = match.MatchedProfile;
  const name = profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown';
  const age = profile?.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const photoUri = profile?.profilePhoto ?? profile?.photos?.[0];
  const compat = match.compatibilityScore ?? profile?.compatibilityScore ?? 0;

  return (
    <TouchableOpacity
      style={[mr.row, { borderBottomColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${name} match`}
    >
      <Avatar uri={photoUri} name={name} size={58} square verified={profile?.isVerified} />

      <View style={mr.body}>
        <Text style={[mr.name, { color: c.fgStrong }]} numberOfLines={1}>{name}{age ? `, ${age}` : ''}</Text>
        <Text style={[mr.sub, { color: c.textMuted }]} numberOfLines={1}>
          {[profile?.profession, profile?.city].filter(Boolean).join(' · ')}
        </Text>
        {compat > 0 && (
          <View style={mr.compatRow}>
            <View style={[mr.compatBar, { backgroundColor: c.surface2 }]}>
              <View style={[mr.compatFill, { width: `${compat}%`, backgroundColor: scoreColour(compat) }]} />
            </View>
            <Text style={[mr.compatPct, { color: c.textMuted }]}>{compat}%</Text>
          </View>
        )}
      </View>

      <View style={mr.actions}>
        {mode === 'mutual' && onChat && (
          <TouchableOpacity style={mr.chatBtn} onPress={onChat} accessibilityLabel="Chat">
            <Ionicons name="chatbubble" size={16} color="#fff" />
          </TouchableOpacity>
        )}
        {mode === 'liked_me' && (
          <View style={mr.acceptRow}>
            {onAccept && (
              <TouchableOpacity style={[mr.circleBtn, { backgroundColor: colours.successBg }]} onPress={onAccept} accessibilityLabel="Accept interest">
                <Ionicons name="heart" size={18} color={colours.success} />
              </TouchableOpacity>
            )}
            {onDecline && (
              <TouchableOpacity style={[mr.circleBtn, { backgroundColor: colours.errorBg }]} onPress={onDecline} accessibilityLabel="Decline interest">
                <Ionicons name="close" size={18} color={colours.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {mode === 'shortlisted' && onRemove && (
          <TouchableOpacity style={[mr.circleBtn, { backgroundColor: colours.goldSoft }]} onPress={onRemove} accessibilityLabel="Remove from shortlist">
            <Ionicons name="bookmark" size={18} color={colours.g600} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
      </View>
    </TouchableOpacity>
  );
}
const mr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.gutter, paddingVertical: 11,
    borderBottomWidth: 0.5, gap: 13,
  },
  body: { flex: 1, gap: 3 },
  name: { ...type.headline, color: colours.fgStrong },
  sub: { ...type.footnote, color: colours.textMuted },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  compatBar: { flex: 1, height: 5, backgroundColor: colours.surface2, borderRadius: borderRadius.pill, overflow: 'hidden' },
  compatFill: { height: 5, borderRadius: borderRadius.pill },
  compatPct: { ...type.caption, color: colours.textMuted, minWidth: 30, textAlign: 'right' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colours.accent, alignItems: 'center', justifyContent: 'center',
  },
  acceptRow: { flexDirection: 'row', gap: spacing.sm },
  circleBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});

// ─── Tab Content ──────────────────────────────────────────────────────────────

function TabContent({ activeTab }: { activeTab: TabKey }) {
  const navigation = useNavigation<Nav>();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  // "Liked Me" reveal is gated to paid plans (mirrors web). Any non-free tier unlocks it.
  const hasPlus = useAuthStore(selectPlan) !== 'free';
  // mutual-match seal celebration (shown after accepting a "Liked Me" interest)
  const [celebrate, setCelebrate] = useState<{ name: string } | null>(null);

  const mutualQuery   = useQuery({ queryKey: queryKeys.mutualMatches,  queryFn: getMutualMatches,  enabled: activeTab === 'mutual' });
  const likedMeQuery  = useQuery({ queryKey: queryKeys.likedMe,        queryFn: getLikedMe,        enabled: activeTab === 'liked_me' });

  // Shortlisted uses offline-aware hook
  const {
    shortlist: offlineShortlist,
    isOffline,
    isStale,
    lastSyncedLabel,
    refetch: refetchShortlist,
  } = useOfflineShortlist();

  const actionMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: MatchAction }) =>
      performMatchAction(userId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likedMe });
      queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      performMatchAction(userId, 'pass'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shortlisted }),
  });

  const queryMap = {
    mutual:   mutualQuery,
    liked_me: likedMeQuery,
  };

  // For shortlisted tab, use offline hook data; for others use React Query
  let matches: Match[];
  let isLoading: boolean;
  let refetch: () => void;

  if (activeTab === 'shortlisted') {
    matches = offlineShortlist;
    isLoading = false;
    refetch = refetchShortlist;
  } else {
    const q = queryMap[activeTab as keyof typeof queryMap];
    matches = (q.data as Match[]) ?? [];
    isLoading = q.isLoading;
    refetch = q.refetch;
  }

  const emptyConfigs: Record<TabKey, { icon: 'heart-circle-outline' | 'bookmark-outline' | 'heart-outline'; title: string; sub: string }> = {
    mutual:      { icon: 'heart-circle-outline', title: 'No mutual matches yet',    sub: "When you both like each other, you'll appear here." },
    shortlisted: { icon: 'bookmark-outline',     title: 'Your shortlist is empty',  sub: 'Shortlist profiles to revisit them anytime.' },
    liked_me:    { icon: 'heart-outline',        title: 'No one has liked you yet', sub: 'Improve your profile to attract more attention.' },
  };

  if (activeTab === 'liked_me' && !hasPlus) {
    return (
      <View style={{ flex: 1, padding: spacing.gutter, justifyContent: 'center' }}>
        <GoldLock
          title="See who liked you"
          subtitle="Unlock everyone who's interested in your profile with Premium."
          ctaLabel="Upgrade now"
          onUnlock={() => navigation.navigate('Subscription')}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <FlatList
        data={[1, 2, 3, 4]}
        keyExtractor={(i) => String(i)}
        renderItem={() => <SkeletonRow />}
        scrollEnabled={false}
      />
    );
  }

  if (matches.length === 0) {
    const cfg = emptyConfigs[activeTab];
    return <SharedEmpty icon={cfg.icon} title={cfg.title} description={cfg.sub} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {activeTab === 'shortlisted' && isOffline && (
        <OfflineBanner
          lastSyncedLabel={lastSyncedLabel}
          isStale={isStale}
          onRefresh={refetchShortlist}
        />
      )}
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            mode={activeTab}
            onPress={() =>
              item.matchedUserId &&
              navigation.navigate('ProfileDetail', { userId: item.matchedUserId })
            }
            onChat={
              activeTab === 'mutual'
                ? () => navigation.navigate('MainTabs', { screen: 'Chat' } as any)
                : undefined
            }
            onAccept={
              activeTab === 'liked_me'
                ? () => {
                    const p = item.MatchedProfile;
                    const nm = p ? `${p.firstName} ${p.lastName}`.trim() : undefined;
                    actionMutation.mutate(
                      { userId: item.userId, action: 'like' },
                      { onSuccess: () => setCelebrate({ name: nm || 'them' }) },
                    );
                  }
                : undefined
            }
            onDecline={
              activeTab === 'liked_me'
                ? () => actionMutation.mutate({ userId: item.userId, action: 'pass' })
                : undefined
            }
            onRemove={
              activeTab === 'shortlisted'
                ? () => removeMutation.mutate({ userId: item.matchedUserId })
                : undefined
            }
          />
        )}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={c.accent} />
        }
        contentContainerStyle={{ paddingBottom: spacing['5xl'] }}
        testID={`matches-list-${activeTab}`}
      />
      <MatchCelebration
        visible={!!celebrate}
        name={celebrate?.name}
        onClose={() => setCelebrate(null)}
        onMessage={() => {
          setCelebrate(null);
          navigation.navigate('MainTabs', { screen: 'Chat' } as never);
        }}
      />
    </View>
  );
}

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('mutual');

  return (
    <View style={[s.container, { backgroundColor: c.background, paddingTop: insets.top }]} testID="MatchesScreen">
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: c.fgStrong }]}>Matches</Text>
      </View>
      {/* Tab bar */}
      <View style={[s.tabBar, { borderBottomColor: c.hairline }]}>
        {TABS.map((tab) => {
          const on = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tab}
              onPress={() => { haptics.light(); setActiveTab(tab.key); }}
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              testID={`tab-${tab.key}`}
            >
              <Text style={[s.tabText, { color: on ? c.accent : c.textMuted }]}>{tab.label}</Text>
              {on && <View style={[s.tabUnderline, { backgroundColor: c.accent }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <TabContent activeTab={activeTab} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 8 },
  headerTitle: { ...type.title1, fontFamily: 'PlayfairDisplay-Bold' },
  tabBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', position: 'relative' },
  tabText: { ...type.subhead, fontFamily: 'Inter-SemiBold' },
  tabUnderline: { position: 'absolute', left: 8, right: 8, bottom: -0.5, height: 2.5, borderRadius: 3 },
});
