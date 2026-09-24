import React, { useEffect, useState } from 'react';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  AccessibilityInfo,
} from 'react-native';
import Text from '../../components/ui/Text';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { scoreColour } from '../../components/cards/ProfileCard';
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
import { LIST_PERF } from '../../constants/listPerf';
import { showToast } from '../../utils/toast';
import { getAge } from '../../utils/dateUtils';
import { tapSize } from '../../utils/elderTheme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type TabKey = 'mutual' | 'shortlisted' | 'liked_me' | 'sent';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'mutual',      label: 'Mutual' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'liked_me',    label: 'Liked Me' },
  { key: 'sent',        label: 'Sent' },
];

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
  const { c, elder } = useTheme();
  const mr = React.useMemo(() => makeMr(c), [c]);
  // Elder mode's 60pt floor. These circles sit 8pt apart and Accept is next to an
  // immediate Decline, so in elder mode the mark itself grows rather than leaning on
  // a hitSlop that would overlap its neighbour.
  const tap = tapSize(elder);
  const circle = elder ? { width: tap, height: tap, borderRadius: tap / 2 } : null;
  const profile = match.MatchedProfile;
  const name = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Unknown'
    : 'Unknown';
  const first = profile?.firstName || 'them';
  const age = profile?.dateOfBirth ? getAge(profile.dateOfBirth) : null;
  const photoUri = profile?.profilePhoto ?? profile?.photos?.[0];
  const compat = match.compatibilityScore ?? profile?.compatibilityScore ?? 0;
  const showNote = (mode === 'liked_me' || mode === 'sent') && !!match.note;
  const hasActions =
    ((mode === 'mutual' || mode === 'liked_me') && !!onChat) ||
    (mode === 'liked_me' && (!!onAccept || !!onDecline)) ||
    (mode === 'shortlisted' && !!onRemove);

  // The old label was "<name> match", which dropped everything a member scans a
  // row for. Say what the eye reads: who, where, how compatible, any note.
  const rowLabel = [
    `${name}${age ? `, ${age}` : ''}`,
    [profile?.profession, profile?.city].filter(Boolean).join(', ') || null,
    compat > 0 ? `${compat}% compatible` : null,
    profile?.isVerified ? 'Verified' : null,
    showNote ? `Note: ${match.note}` : null,
  ].filter(Boolean).join('. ');

  return (
    // A plain container: the tappable profile area and the action buttons are
    // SIBLINGS. Buttons nested inside the row's own pressable were unreachable
    // by VoiceOver, which treats an accessible parent as a single element.
    <View style={[mr.row, { borderBottomColor: c.border }]}>
      <PressableScale
        style={mr.main}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={rowLabel}
        accessibilityHint="Opens profile"
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
          {showNote ? (
            <Text variant="footnote" color="textSecondary" style={mr.noteLine} numberOfLines={2}>
              “{match.note}”
            </Text>
          ) : null}
        </View>

        {!hasActions && <Ionicons name="chevron-forward" size={16} color={c.textMuted} />}
      </PressableScale>

      {hasActions && (
        <View style={mr.actions}>
          {/* An interest the member has accepted is now a mutual match: chat replaces the pair. */}
          {(mode === 'mutual' || mode === 'liked_me') && onChat && (
            <PressableScale
              scaleTo={0.9}
              style={[mr.chatBtn, circle]}
              onPress={onChat}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${first}`}
              testID={`match-chat-${match.id}-tap44-hitslop`}
              hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chatbubble" size={16} color={c.onPrimary} />
            </PressableScale>
          )}
          {mode === 'liked_me' && (
            <View style={mr.acceptRow}>
              {onAccept && (
                <PressableScale
                  scaleTo={0.9}
                  haptic
                  style={[mr.circleBtn, circle, { backgroundColor: c.successBg }]}
                  onPress={onAccept}
                  accessibilityRole="button"
                  accessibilityLabel={`Accept interest from ${first}`}
                  testID={`match-accept-${match.id}-tap44-hitslop`}
                  hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="heart" size={18} color={c.successAccent} />
                </PressableScale>
              )}
              {onDecline && (
                <PressableScale
                  scaleTo={0.9}
                  haptic
                  style={[mr.circleBtn, circle, { backgroundColor: c.errorBg }]}
                  onPress={onDecline}
                  accessibilityRole="button"
                  accessibilityLabel={`Decline interest from ${first}`}
                  testID={`match-decline-${match.id}-tap44-hitslop`}
                  hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color={c.error} />
                </PressableScale>
              )}
            </View>
          )}
          {mode === 'shortlisted' && onRemove && (
            <PressableScale
              scaleTo={0.9}
              haptic
              style={[mr.circleBtn, circle, { backgroundColor: c.accentSoft }]}
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${first} from shortlist`}
              testID={`match-remove-${match.id}-tap44-hitslop`}
              hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="bookmark" size={18} color={c.accent} />
            </PressableScale>
          )}
        </View>
      )}
    </View>
  );
}
const makeMr = (c: ThemeColours) => StyleSheet.create({
  noteLine: { fontStyle: 'italic', marginTop: 3 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.gutter, paddingVertical: 11,
    borderBottomWidth: 0.5, gap: 13,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  body: { flex: 1, gap: 3 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  compatBar: { flex: 1, height: 5, backgroundColor: c.surface2, borderRadius: borderRadius.pill, overflow: 'hidden' },
  compatFill: { height: 5, borderRadius: borderRadius.pill },
  compatPct: { minWidth: 30, textAlign: 'right' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Fill is `p500`, not `accent`: in dark mode `accent` is the lighter #C75D7E, which only
  // reaches 3.97:1 against the white glyph. `p500` holds in both themes.
  chatBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: c.p500, alignItems: 'center', justifyContent: 'center',
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
  const [celebrate, setCelebrate] = useState<{ name: string; userId: string; photo?: string } | null>(null);
  // The likes endpoint does not exclude people the member has already answered, so a
  // refetch returns them again. Remember the answer here so Decline visibly removes the
  // row and an accepted row stops offering Accept/Decline while this screen is open.
  const [answered, setAnswered] = useState<Record<string, 'accepted' | 'declined'>>({});
  // The server now says what the member already did about each liker (`myAction`), which
  // survives a restart and covers a like made from Search or a profile; the local map
  // covers taps on this screen before the refetch lands and an older server without the field.
  const answerOf = (m: Match): 'accepted' | 'declined' | undefined =>
    answered[m.matchedUserId] ??
    (m.myAction === 'pass' ? 'declined' : m.myAction === 'like' ? 'accepted' : undefined);

  const mutualQuery   = useQuery({ queryKey: queryKeys.mutualMatches,  queryFn: getMutualMatches,  enabled: activeTab === 'mutual' });
  // A free member is shown the lock instead; firing the request anyway would only 403.
  const likedMeQuery  = useQuery({ queryKey: queryKeys.likedMe,        queryFn: getLikedMe,        enabled: activeTab === 'liked_me' && hasPlus });
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
    onSuccess: (_data, { userId, action }) => {
      setAnswered((a) => ({ ...a, [userId]: action === 'pass' ? 'declined' : 'accepted' }));
      queryClient.invalidateQueries({ queryKey: queryKeys.likedMe });
      queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
      // The row leaves the list with no tap on anything new; say so.
      if (action === 'pass') AccessibilityInfo.announceForAccessibility('Interest declined');
    },
    // A tap that fails must not read as a tap that did nothing.
    onError: () => showToast.error("That didn't go through", 'Check your connection and try again.'),
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      performMatchAction(userId, 'pass'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shortlisted });
      AccessibilityInfo.announceForAccessibility('Removed from your shortlist');
    },
    onError: () => showToast.error("Couldn't remove from your shortlist", 'Check your connection and try again.'),
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
  let isRefreshing: boolean;
  let refetch: () => unknown;

  if (activeTab === 'shortlisted') {
    matches = offlineShortlist;
    // Offline reads come from the MMKV cache, so only claim "loading" while a
    // fetch is genuinely expected and there is nothing cached to show.
    isLoading =
      !isOffline &&
      matches.length === 0 &&
      (shortlistQuery.isPending || (shortlistQuery.isError && shortlistQuery.isFetching));
    // Offline with nothing cached is "unknown", not "empty". NetInfo answers at once but
    // the request started at mount keeps retrying for seconds; in that window the query
    // is neither loading nor errored, and the screen used to claim the shortlist was empty.
    isError = shortlistQuery.isError || (isOffline && matches.length === 0);
    isRefreshing = matches.length > 0 && shortlistQuery.isFetching;
    refetch = refetchShortlist;
  } else {
    const q = queryMap[activeTab as keyof typeof queryMap];
    matches = (q.data as Match[]) ?? [];
    // A retry from the error state shows the skeleton again instead of
    // leaving the error card sitting there while the request is in flight.
    isLoading = q.isLoading || (q.isError && q.isFetching && matches.length === 0);
    isError = q.isError;
    isRefreshing = q.isRefetching;
    refetch = q.refetch;
  }

  // A pull that fails must not look like a pull that found nothing new (Home and
  // Notifications already say so). The shortlist hook's own refetch returns nothing,
  // so that tab reads the same cache entry's fetch result directly; offline the hook
  // does not fetch at all and the banner already explains why.
  const onRefresh = async () => {
    const res = activeTab === 'shortlisted'
      ? (isOffline ? undefined : await shortlistQuery.refetch())
      : ((await refetch()) as { isError?: boolean } | undefined);
    if (res?.isError) showToast.error("Couldn't refresh", 'Check your connection and try again.');
  };

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

  // The error card swaps in with no tap on anything, so say it (iOS ignores
  // accessibilityLiveRegion, hence by hand). The free member's lock is not an error.
  const loadFailed = !(activeTab === 'liked_me' && !hasPlus) && isError && matches.length === 0;
  const errorAnnouncement =
    activeTab === 'shortlisted' && isOffline
      ? "You're offline. Your shortlist will load when you're back online."
      : `Couldn't load ${errorNouns[activeTab]}`;
  useEffect(() => {
    if (loadFailed) AccessibilityInfo.announceForAccessibility(errorAnnouncement);
  }, [loadFailed, errorAnnouncement]);

  if (activeTab === 'liked_me' && !hasPlus) {
    return (
      // Centred in the visible area, i.e. above the floating pill, not behind it.
      <View style={{ flex: 1, padding: spacing.gutter, paddingBottom: spacing.gutter + tabClearance, justifyContent: 'center' }}>
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
      <View accessible accessibilityLabel="Loading matches" accessibilityState={{ busy: true }} style={{ flex: 1 }}>
        <FlatList
          data={[1, 2, 3, 4]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonRow />}
          scrollEnabled={false}
        />
      </View>
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

  // Declined likers leave the list; an empty result after answering everyone is not
  // "no one has liked you".
  const rows = activeTab === 'liked_me'
    ? matches.filter((m) => answerOf(m) !== 'declined')
    : matches;
  const caughtUp = activeTab === 'liked_me' && matches.length > 0 && rows.length === 0;

  if (rows.length === 0) {
    const cfg = caughtUp
      ? {
          icon: 'heart-circle-outline' as const,
          title: "You're all caught up",
          sub: 'New interest from other members will show up here.',
          actionLabel: 'Browse profiles',
          onAction: () => navigation.navigate('MainTabs', { screen: 'Search' }),
        }
      : emptyConfigs[activeTab];
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
        {...LIST_PERF}
        data={rows}
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
              (activeTab === 'mutual' || (activeTab === 'liked_me' && answerOf(item) === 'accepted')) && !elderMode
                ? () => {
                    // Open THIS person's thread: the button says "Chat with <name>", and
                    // landing on the conversation list made the member find them again.
                    const p = item.MatchedProfile;
                    navigation.navigate('ChatThread', {
                      userId: item.matchedUserId,
                      name: p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : '',
                      photo: p?.profilePhoto ?? p?.photos?.[0] ?? undefined,
                    });
                  }
                : undefined
            }
            onAccept={
              activeTab === 'liked_me' && !answerOf(item)
                ? () => {
                    const p = item.MatchedProfile;
                    const nm = p ? `${p.firstName} ${p.lastName}`.trim() : undefined;
                    // `matchedUserId` is the other member. `userId` is '' on every Match built
                    // by api/matches toMatch(), which POSTed to `/match/` and always 404'd.
                    actionMutation.mutate(
                      { userId: item.matchedUserId, action: 'like' },
                      {
                        onSuccess: () =>
                          setCelebrate({
                            name: nm || 'them',
                            userId: item.matchedUserId,
                            photo: p?.profilePhoto ?? p?.photos?.[0] ?? undefined,
                          }),
                      },
                    );
                  }
                : undefined
            }
            onDecline={
              activeTab === 'liked_me' && !answerOf(item)
                ? () => actionMutation.mutate({ userId: item.matchedUserId, action: 'pass' })
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
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[c.accent]} tintColor={c.accent} />
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
                // Straight into the thread with the person just matched, not the chat list.
                const who = celebrate;
                setCelebrate(null);
                if (who) navigation.navigate('ChatThread', { userId: who.userId, name: who.name, photo: who.photo });
              }
        }
      />
    </View>
  );
}

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const { c, elder } = useTheme();
  const tabHeight = tapSize(elder);
  const navigation = useNavigation();
  const route = useRoute();
  const [activeTab, setActiveTab] = useState<TabKey>('mutual');

  // Other screens deep-link into a tab ("Liked you" on Home, an
  // interest-received notification). This screen stays mounted inside the tab
  // navigator, so the param is read as an event: honour it, then clear it so
  // the same link works again after the member has switched tabs by hand.
  const requestedTab = (route.params as { tab?: TabKey } | undefined)?.tab;
  useEffect(() => {
    if (!requestedTab) return;
    if (TABS.some((t) => t.key === requestedTab)) setActiveTab(requestedTab);
    navigation.setParams({ tab: undefined } as never);
  }, [requestedTab, navigation]);

  return (
    <Screen edges={['top']} style={s.container} testID="MatchesScreen">
      <View style={s.header}>
        <Text variant="title1" color="fgStrong" accessibilityRole="header">Matches</Text>
      </View>
      {/* Tab bar */}
      <View style={[s.tabBar, { borderBottomColor: c.hairline }]} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const on = activeTab === tab.key;
          return (
            <PressableScale
              key={tab.key}
              style={[s.tab, { minHeight: tabHeight }]}
              onPress={() => setActiveTab(tab.key)}
              haptic={!on}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              testID={`tab-${tab.key}`}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {/* four equal columns: the label shrinks rather than wrapping the tab onto two lines */}
              <Text variant="subhead" color={on ? 'primary' : 'textMuted'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxScale={1.3}>{tab.label}</Text>
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
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabUnderline: { position: 'absolute', left: 8, right: 8, bottom: -0.5, height: 2.5, borderRadius: 3 },
});
