import React, { useCallback, useState } from 'react';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Text from '../../components/ui/Text';
import SmartImage from '../../components/common/SmartImage';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import {
  getMutualMatches,
  getShortlisted,
  getLikedMe,
  getSentInterests,
  performMatchAction,
} from '../../api/matches';
import { queryKeys } from '../../constants/queryKeys';
import { useOfflineShortlist } from '../../hooks/useOfflineShortlist';
import OfflineBanner from '../../components/common/OfflineBanner';
import { Avatar, EmptyState as SharedEmpty, GoldLock, SkeletonRow, MatchCelebration } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import type { MainStackParamList } from '../../navigation/types';
import type { Match, MatchAction } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { hasPremiumAccess } from '../../utils/entitlements';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type TabKey = 'mutual' | 'shortlisted' | 'liked_me' | 'sent';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'mutual',      label: 'Mutual' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'liked_me',    label: 'Liked Me' },
  { key: 'sent',        label: 'Sent' },
];

// `success` reads correctly as status text but is documented as unreadable as
// an accent on a dark surfaceCard — `successAccent` is the theme-reactive
// pair that stays legible as a score dot/fill in both themes.
const scoreColour = (p: number, c: ThemeColours) => (p >= 90 ? c.successAccent : p >= 75 ? c.accent : c.textMuted);

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
  const mr = React.useMemo(() => makeMr(c), [c]);
  const profile = match.MatchedProfile;
  const name = profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown';
  const age = profile?.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const photoUri = profile?.profilePhoto ?? profile?.photos?.[0];
  const compat = match.compatibilityScore ?? profile?.compatibilityScore ?? 0;

  return (
    <PressableScale
      style={[mr.row, { borderBottomColor: c.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} match`}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Avatar uri={photoUri} name={name} size={58} square verified={profile?.isVerified} />

      <View style={mr.body}>
        <Text variant="headline" color="fgStrong" numberOfLines={1}>{name}{age ? `, ${age}` : ''}</Text>
        <Text variant="footnote" color="textMuted" numberOfLines={1}>
          {[profile?.profession, profile?.city].filter(Boolean).join(' · ')}
        </Text>
        {compat > 0 && (
          <View style={mr.compatRow}>
            <View style={[mr.compatBar, { backgroundColor: c.surface2 }]}>
              <View style={[mr.compatFill, { width: `${compat}%`, backgroundColor: scoreColour(compat, c) }]} />
            </View>
            <Text variant="caption" color="textMuted" style={mr.compatPct}>{compat}%</Text>
          </View>
        )}
        {/* D3: a like-with-note leads with the quoted note (liked_me + sent). */}
        {(mode === 'liked_me' || mode === 'sent') && match.note ? (
          <Text variant="footnote" color="textSecondary" style={mr.noteLine} numberOfLines={2}>
            “{match.note}”
          </Text>
        ) : null}
      </View>

      <View style={mr.actions}>
        {mode === 'mutual' && onChat && (
          <PressableScale scaleTo={0.9} haptic style={mr.chatBtn} onPress={onChat} accessibilityRole="button" accessibilityLabel="Chat">
            <Ionicons name="chatbubble" size={16} color="#fff" />
          </PressableScale>
        )}
        {mode === 'liked_me' && (
          <View style={mr.acceptRow}>
            {onAccept && (
              <PressableScale scaleTo={0.9} haptic style={[mr.circleBtn, { backgroundColor: c.successBg }]} onPress={onAccept} accessibilityRole="button" accessibilityLabel="Accept interest">
                <Ionicons name="heart" size={18} color={c.success} />
              </PressableScale>
            )}
            {onDecline && (
              <PressableScale scaleTo={0.9} haptic style={[mr.circleBtn, { backgroundColor: c.errorBg }]} onPress={onDecline} accessibilityRole="button" accessibilityLabel="Decline interest">
                <Ionicons name="close" size={18} color={c.error} />
              </PressableScale>
            )}
          </View>
        )}
        {mode === 'shortlisted' && onRemove && (
          <PressableScale scaleTo={0.9} haptic style={[mr.circleBtn, { backgroundColor: c.accentSoft }]} onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove from shortlist">
            <Ionicons name="bookmark" size={18} color={c.accent} />
          </PressableScale>
        )}
        <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
      </View>
    </PressableScale>
  );
}
const makeMr = (c: ThemeColours) => StyleSheet.create({
  noteLine: { fontStyle: 'italic', marginTop: 3 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.gutter, paddingVertical: 11,
    borderBottomWidth: 0.5, gap: 13,
  },
  body: { flex: 1, gap: 3 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  compatBar: { flex: 1, height: 5, backgroundColor: c.surface2, borderRadius: borderRadius.pill, overflow: 'hidden' },
  compatFill: { height: 5, borderRadius: borderRadius.pill },
  compatPct: { minWidth: 30, textAlign: 'right' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
  },
  acceptRow: { flexDirection: 'row', gap: spacing.sm },
  circleBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});

// ─── Tab Content ──────────────────────────────────────────────────────────────

function TabContent({ activeTab }: { activeTab: TabKey }) {
  const tabClearance = useTabBarClearance();
  const navigation = useNavigation<Nav>();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  // "Liked Me" is a requirePremium surface on the server, NOT a chat surface, so
  // it deliberately does not consult the free-chat-for-mutuals flag. Turning that
  // flag on opens chat; it must not silently hand out every paid surface.
  const authUser = useAuthStore((st) => st.user);
  const hasPlus = hasPremiumAccess(authUser);
  // Elder mode removes the Chat tab from the navigator entirely, so navigating
  // to it is a silent no-op — the button looked live and did nothing. Hide the
  // chat affordances instead of offering a dead one.
  const elderMode = useUIStore((st) => st.elderMode);
  // mutual-match seal celebration (shown after accepting a "Liked Me" interest)
  const [celebrate, setCelebrate] = useState<{ name: string } | null>(null);

  const mutualQuery   = useQuery({ queryKey: queryKeys.mutualMatches,  queryFn: getMutualMatches,  enabled: activeTab === 'mutual' });
  const likedMeQuery  = useQuery({ queryKey: queryKeys.likedMe,        queryFn: getLikedMe,        enabled: activeTab === 'liked_me' });
  const sentQuery     = useQuery({ queryKey: queryKeys.sentInterests,  queryFn: getSentInterests,  enabled: activeTab === 'sent' });

  // Shortlisted uses offline-aware hook
  const {
    shortlist: offlineShortlist,
    isOffline,
    isStale,
    lastSyncedLabel,
    refetch: refetchShortlist,
  } = useOfflineShortlist();

  // useOfflineShortlist owns the shortlist fetch but only returns the list, so
  // "still loading" and "failed" both look like "empty". This passive observer
  // (same key, enabled:false, so no second fetch) reads the status of that
  // same cache entry.
  const shortlistQuery = useQuery({ queryKey: queryKeys.shortlisted, queryFn: getShortlisted, enabled: false });

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
    sent:     sentQuery,
  };

  // For shortlisted tab, use offline hook data; for others use React Query
  let matches: Match[];
  let isLoading: boolean;
  let isError: boolean;
  let refetch: () => void;

  if (activeTab === 'shortlisted') {
    matches = offlineShortlist;
    // Offline reads come from the MMKV cache, so only claim "loading" while a
    // fetch is genuinely expected and there is nothing cached to show.
    isLoading =
      !isOffline &&
      matches.length === 0 &&
      (shortlistQuery.isPending || (shortlistQuery.isError && shortlistQuery.isFetching));
    isError = shortlistQuery.isError;
    refetch = refetchShortlist;
  } else {
    const q = queryMap[activeTab as keyof typeof queryMap];
    matches = (q.data as Match[]) ?? [];
    // A retry from the error state shows the skeleton again instead of
    // leaving the error card sitting there while the request is in flight.
    isLoading = q.isLoading || (q.isError && q.isFetching && matches.length === 0);
    isError = q.isError;
    refetch = q.refetch;
  }

  const errorNouns: Record<TabKey, string> = {
    mutual:      'your matches',
    shortlisted: 'your shortlist',
    liked_me:    'people who liked you',
    sent:        'your sent interests',
  };

  const emptyConfigs: Record<TabKey, {
    icon: 'heart-circle-outline' | 'bookmark-outline' | 'heart-outline' | 'paper-plane-outline';
    title: string;
    sub: string;
    actionLabel: string;
    onAction: () => void;
  }> = {
    mutual: {
      icon: 'heart-circle-outline',
      title: 'No mutual matches yet',
      sub: "When you both like each other, you'll appear here.",
      actionLabel: "See today's matches",
      onAction: () => navigation.navigate('MainTabs', { screen: 'Home' }),
    },
    shortlisted: {
      icon: 'bookmark-outline',
      title: 'Your shortlist is empty',
      sub: 'Shortlist profiles to revisit them anytime.',
      actionLabel: 'Browse profiles',
      onAction: () => navigation.navigate('MainTabs', { screen: 'Search' }),
    },
    liked_me: {
      icon: 'heart-outline',
      title: 'No one has liked you yet',
      sub: 'Improve your profile to attract more attention.',
      actionLabel: 'Improve your profile',
      onAction: () => navigation.navigate('EditProfile'),
    },
    sent: {
      icon: 'paper-plane-outline',
      title: "You haven't reached out yet",
      sub: "Profiles you like show up here. Today's matches are waiting.",
      actionLabel: "See today's matches",
      onAction: () => navigation.navigate('MainTabs', { screen: 'Home' }),
    },
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

  // Only when there is nothing to show: a failed background refetch must not
  // blank a list we already have, and a failed load must never read as "empty".
  if (isError && matches.length === 0) {
    return (
      <SharedEmpty
        variant="error"
        icon="cloud-offline-outline"
        title={`Couldn't load ${errorNouns[activeTab]}`}
        description={
          activeTab === 'shortlisted' && isOffline
            ? "You're offline. Your shortlist will load when you're back online."
            : 'Check your connection and try again.'
        }
        actionLabel={activeTab === 'shortlisted' && isOffline ? undefined : 'Try again'}
        onAction={activeTab === 'shortlisted' && isOffline ? undefined : () => refetch()}
        testID="MatchesScreen-error"
      />
    );
  }

  if (matches.length === 0) {
    const cfg = emptyConfigs[activeTab];
    return (
      <SharedEmpty
        icon={cfg.icon}
        title={cfg.title}
        description={cfg.sub}
        actionLabel={cfg.actionLabel}
        onAction={cfg.onAction}
        testID={`MatchesScreen-empty-${activeTab}`}
      />
    );
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
              activeTab === 'mutual' && !elderMode
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
        contentContainerStyle={{ paddingBottom: spacing['5xl'] + tabClearance }}
        testID={`matches-list-${activeTab}`}
      />
      <MatchCelebration
        visible={!!celebrate}
        name={celebrate?.name}
        onClose={() => setCelebrate(null)}
        onMessage={
          elderMode
            ? undefined
            : () => {
                setCelebrate(null);
                navigation.navigate('MainTabs', { screen: 'Chat' } as never);
              }
        }
      />
    </View>
  );
}

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const { c } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('mutual');

  return (
    <Screen edges={['top']} style={s.container} testID="MatchesScreen">
      <View style={s.header}>
        <Text variant="title1" color="fgStrong">Matches</Text>
      </View>
      {/* Tab bar */}
      <View style={[s.tabBar, { borderBottomColor: c.hairline }]}>
        {TABS.map((tab) => {
          const on = activeTab === tab.key;
          return (
            <PressableScale
              key={tab.key}
              style={s.tab}
              onPress={() => setActiveTab(tab.key)}
              haptic
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              testID={`tab-${tab.key}`}
            >
              <Text variant="subhead" color={on ? 'primary' : 'textMuted'}>{tab.label}</Text>
              {on && <View style={[s.tabUnderline, { backgroundColor: c.accent }]} />}
            </PressableScale>
          );
        })}
      </View>

      {/* Content */}
      <TabContent activeTab={activeTab} />
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 8 },
  tabBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', position: 'relative' },
  tabUnderline: { position: 'absolute', left: 8, right: 8, bottom: -0.5, height: 2.5, borderRadius: 3 },
});
