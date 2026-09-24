import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  AccessibilityInfo,
} from 'react-native';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { PressableScale } from '../../components/motion';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NotificationsSkeleton } from '../../components/ui/skeletons';
import EmptyState from '../../components/ui/EmptyState';
import ListFooter from '../../components/ui/ListFooter';
import Button from '../../components/ui/Button';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import type { Conversation, Notification, NotificationType } from '../../types';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import {
  getNotifications,
  markRead,
  markAllRead,
} from '../../api/notifications';
import { showToast } from '../../utils/toast';
import { LIST_PERF } from '../../constants/listPerf';
import { tapSize } from '../../utils/elderTheme';

type NavProp = NavigationProp<MainStackParamList>;

// Every colour comes off the theme. `successAccent` (not `success`) because the
// icon sits on a tinted circle over a dark surfaceCard in dark mode, where
// `success` is documented as unreadable.
const makeIconMap = (c: ThemeColours): Record<NotificationType, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> => ({
  new_match:              { name: 'heart',              color: c.accent },
  new_message:            { name: 'chatbubble',         color: c.info },
  interest_received:      { name: 'star',               color: c.accent },
  interest_accepted:      { name: 'checkmark-circle',   color: c.successAccent },
  verification_approved:  { name: 'shield-checkmark',   color: c.successAccent },
  verification_rejected:  { name: 'shield-outline',     color: c.error },
  subscription_expiring:  { name: 'time',               color: c.warning },
  profile_view:           { name: 'eye',                color: c.textMuted },
  report_reviewed:        { name: 'flag',               color: c.warning },
  system:                 { name: 'information-circle', color: c.textMuted },
});

interface Peer { name: string; photo?: string }

function navigateForNotification(
  nav: NavProp,
  type: NotificationType,
  relatedId: string | null,
  /** Who a `relatedId` is, when the conversation list already knows. */
  peerFor: (userId: string) => Peer | undefined,
) {
  switch (type) {
    case 'new_match':
    case 'interest_accepted':
      nav.navigate('MainTabs', { screen: 'Matches' });
      break;
    case 'interest_received':
      // Someone liked you: land on the Liked Me tab, not the default Mutual one.
      // `Matches` declares no params in MainTabParamList, hence the cast.
      nav.navigate('MainTabs', { screen: 'Matches', params: { tab: 'liked_me' } } as never);
      break;
    case 'new_message': {
      if (!relatedId) break;
      // The payload carries only the id. Seed the header from the conversation list when it
      // is cached so the thread opens with a name on the first frame; when it is not, an empty
      // name makes ChatThread fetch the profile itself.
      const peer = peerFor(relatedId);
      nav.navigate('ChatThread', { userId: relatedId, name: peer?.name ?? '', photo: peer?.photo });
      break;
    }
    case 'verification_approved':
    case 'verification_rejected':
      nav.navigate('Verification');
      break;
    case 'subscription_expiring':
      nav.navigate('Subscription');
      break;
    case 'profile_view':
      nav.navigate('MainTabs', { screen: 'Profile' });
      break;
    default:
      break;
  }
}

function NotificationItem({
  item,
  onPress,
}: {
  item: Notification;
  onPress: (item: Notification) => void;
}) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const ICON_MAP = React.useMemo(() => makeIconMap(c), [c]);
  const icon = ICON_MAP[item.type] ?? ICON_MAP.system;
  const relTime = formatRelativeTime(item.createdAt);
  // The body is the part that says what happened. It used to be left out of the
  // label, so a screen reader announced a title and never the message.
  const label = [item.title, item.body, relTime, item.isRead ? null : 'Unread'].filter(Boolean).join('. ');

  return (
    <PressableScale
      style={[styles.item, !item.isRead && styles.itemUnread]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`notification-item-${item.id}`}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={[styles.iconWrap, { backgroundColor: icon.color + '20' }]}>
        <Ionicons name={icon.name} size={22} color={icon.color} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text variant="subhead" color="textPrimary" style={styles.title} numberOfLines={1}>{item.title}</Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text variant="footnote" color="textSecondary" style={styles.body} numberOfLines={2}>{item.body}</Text>
        <Text variant="caption" color="textMuted">{relTime}</Text>
      </View>
    </PressableScale>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const { c, elder } = useTheme();
  // Elder mode's 60pt floor for the two header controls (both are otherwise 44 via hitSlop).
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<NavProp>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    isFetchNextPageError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) => getNotifications(pageParam as string | undefined),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: (_data, id) => {
      queryClient.setQueryData<typeof data>(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            notifications: page.notifications.map((n) =>
              n.id === id ? { ...n, isRead: true } : n
            ),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.setQueryData<typeof data>(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            notifications: page.notifications.map((n) => ({ ...n, isRead: true })),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      // The rows restyle and the button disappears with no tap on anything
      // new, so a screen-reader user hears nothing unless we say it.
      AccessibilityInfo.announceForAccessibility('All notifications marked as read');
    },
    // A tap that fails must not look like a tap that did nothing.
    onError: () => showToast.error("Couldn't mark all as read", 'Check your connection and try again.'),
  });

  const peerFor = useCallback(
    (userId: string): Peer | undefined => {
      const convo = queryClient
        .getQueryData<Conversation[]>(queryKeys.conversations)
        ?.find((cv) => cv.userId === userId);
      if (!convo) return undefined;
      const name = [convo.profile.firstName, convo.profile.lastName].filter(Boolean).join(' ');
      return name ? { name, photo: convo.profile.profilePhoto ?? undefined } : undefined;
    },
    [queryClient]
  );

  const handlePress = useCallback(
    (item: Notification) => {
      if (!item.isRead) markReadMutation.mutate(item.id);
      navigateForNotification(navigation, item.type, item.relatedId, peerFor);
    },
    [navigation, markReadMutation, peerFor]
  );

  // A failed next page used to end the list without a word. Announce it too: the footer
  // row appearing is not something a screen reader user is told about.
  useEffect(() => {
    if (isFetchNextPageError) AccessibilityInfo.announceForAccessibility("Couldn't load more notifications");
  }, [isFetchNextPageError]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const res = await refetch();
    setRefreshing(false);
    if (res.isError) showToast.error("Couldn't refresh", 'Check your connection and try again.');
  }, [refetch]);

  const allNotifications = data?.pages.flatMap((p) => p.notifications) ?? [];
  const hasUnread = allNotifications.some((n) => !n.isRead);

  // The error card swaps in with no tap on anything, so say it (iOS ignores
  // accessibilityLiveRegion, hence by hand).
  const loadFailed = !isLoading && isError && allNotifications.length === 0;
  useEffect(() => {
    if (loadFailed) AccessibilityInfo.announceForAccessibility("Couldn't load notifications");
  }, [loadFailed]);

  return (
    <Screen edges={['top', 'bottom']} style={styles.container} testID="NotificationsScreen">
      {/* Header: always rendered, so there is a way back while loading or after an error. */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation.canGoBack() && (
            <PressableScale
              onPress={() => navigation.goBack()}
              style={[styles.backBtn, elder && { minWidth: tap, minHeight: tap, alignItems: 'center', justifyContent: 'center' }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="notifications-back-tap44-hitslop"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
            </PressableScale>
          )}
          <Text variant="title2" color="textPrimary" accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>Notifications</Text>
        </View>
        {hasUnread && (
          <PressableScale
            style={elder ? { minHeight: tap, justifyContent: 'center' } : undefined}
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            accessibilityRole="button"
            // The visible words, so Voice Control's "tap Mark all read" resolves.
            accessibilityLabel="Mark all read"
            accessibilityState={{ disabled: markAllReadMutation.isPending }}
            testID="mark-all-read-button-tap44-hitslop"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color="primary" numberOfLines={1} maxScale={1.3}>Mark all read</Text>
          </PressableScale>
        )}
      </View>

      {isLoading ? (
        // Decorative skeleton: one busy element instead of nine empty rows.
        <View accessible accessibilityLabel="Loading notifications" accessibilityState={{ busy: true }}>
          <NotificationsSkeleton />
        </View>
      ) : loadFailed ? (
        <View style={styles.emptyContent}>
          <EmptyState
            variant="error"
            icon="cloud-offline-outline"
            title="Couldn't load notifications"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="NotificationsScreen-error"
          />
        </View>
      ) : (
        <FlatList
          {...LIST_PERF}
          data={allNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem item={item} onPress={handlePress} />
          )}
          contentContainerStyle={
            allNotifications.length === 0 ? styles.emptyContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[c.accent]}
              tintColor={c.accent}
            />
          }
          onEndReached={() => {
            // Not after a failed page: the list stays at the end and would re-fire endlessly.
            if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchNextPageError && !isFetchingNextPage ? (
              <View style={styles.pageError} accessibilityLiveRegion="polite" testID="notifications-page-error">
                <Text variant="footnote" color="textMuted" style={styles.pageErrorText}>Couldn't load more notifications.</Text>
                <Button title="Try again" variant="secondary" size="sm" onPress={() => fetchNextPage()} testID="notifications-page-retry" />
              </View>
            ) : (
              <ListFooter state={isFetchingNextPage ? 'loading' : 'idle'} />
            )
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="No notifications yet"
              description="We'll let you know when you get a new match, message or interest."
              actionLabel="Browse profiles"
              onAction={() => navigation.navigate('MainTabs', { screen: 'Search' })}
              testID="NotificationsScreen-empty"
            />
          }
        />
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: c.hairline,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  headerTitle: { flexShrink: 1 },
  backBtn: {
    marginLeft: -spacing.sm,
    padding: spacing.xs,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: c.background,
  },
  itemUnread: {
    backgroundColor: c.primaryLight,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.accent,
    marginLeft: spacing.sm,
  },
  body: {
    marginBottom: 4,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageError: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.gutter,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageErrorText: { textAlign: 'center' },
});
