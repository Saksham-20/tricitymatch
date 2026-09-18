import React, { useCallback, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { PressableScale } from '../../components/motion';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NotificationsSkeleton } from '../../components/ui/skeletons';
import ListFooter from '../../components/ui/ListFooter';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import type { Notification, NotificationType } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import {
  getNotifications,
  markRead,
  markAllRead,
} from '../../api/notifications';

type NavProp = NavigationProp<MainStackParamList>;

const makeIconMap = (c: ThemeColours): Record<NotificationType, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> => ({
  new_match:              { name: 'heart',              color: c.primary },
  new_message:            { name: 'chatbubble',         color: '#3B82F6' },
  interest_received:      { name: 'star',               color: c.warning },
  interest_accepted:      { name: 'checkmark-circle',   color: c.success },
  verification_approved:  { name: 'shield-checkmark',   color: c.success },
  verification_rejected:  { name: 'shield-outline',     color: '#EF4444' },
  subscription_expiring:  { name: 'time',               color: c.warning },
  profile_view:           { name: 'eye',                color: c.textMuted },
  report_reviewed:        { name: 'flag',               color: c.warning },
  system:                 { name: 'information-circle', color: c.textMuted },
});

function navigateForNotification(nav: NavProp, type: NotificationType, relatedId: string | null) {
  switch (type) {
    case 'new_match':
    case 'interest_accepted':
    case 'interest_received':
      nav.navigate('MainTabs', { screen: 'Matches' });
      break;
    case 'new_message':
      if (relatedId) nav.navigate('ChatThread', { userId: relatedId, name: '' });
      break;
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

  return (
    <PressableScale
      style={[styles.item, !item.isRead && styles.itemUnread]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.isRead ? 'Read' : 'Unread'}. ${relTime}`}
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
  const { c } = useTheme();
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
    },
  });

  const handlePress = useCallback(
    (item: Notification) => {
      if (!item.isRead) markReadMutation.mutate(item.id);
      navigateForNotification(navigation, item.type, item.relatedId);
    },
    [navigation, markReadMutation]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const allNotifications = data?.pages.flatMap((p) => p.notifications) ?? [];
  const hasUnread = allNotifications.some((n) => !n.isRead);

  if (isLoading) {
    return (
      <Screen edges={['top']} style={styles.container} testID="NotificationsScreen">
        <NotificationsSkeleton />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} style={styles.container} testID="NotificationsScreen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation.canGoBack() && (
            <PressableScale
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="notifications-back"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
            </PressableScale>
          )}
          <Text variant="title2" color="textPrimary">Notifications</Text>
        </View>
        {hasUnread && (
          <PressableScale
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            accessibilityState={{ disabled: markAllReadMutation.isPending }}
            testID="mark-all-read-button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color="primary">Mark all read</Text>
          </PressableScale>
        )}
      </View>

      <FlatList
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
            colors={[c.primary]}
            tintColor={c.primary}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={<ListFooter state={isFetchingNextPage ? 'loading' : 'idle'} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={56} color={c.textMuted} />
            <Text variant="headline" color="textPrimary" style={styles.emptyTitle}>No notifications yet</Text>
            <Text variant="footnote" color="textMuted" style={styles.emptyBody}>
              We'll let you know when you get a new match, message, or interest.
            </Text>
          </View>
        }
      />
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceCard,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
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
    backgroundColor: c.primary,
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
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['5xl'],
  },
  emptyTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.lg,
  },
});
