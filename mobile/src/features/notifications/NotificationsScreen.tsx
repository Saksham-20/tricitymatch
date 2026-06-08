import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import type { Notification, NotificationType } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import {
  getNotifications,
  markRead,
  markAllRead,
} from '../../api/notifications';

type NavProp = NavigationProp<MainStackParamList>;

const ICON_MAP: Record<NotificationType, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  new_match:              { name: 'heart',              color: colours.primary },
  new_message:            { name: 'chatbubble',         color: '#3B82F6' },
  interest_received:      { name: 'star',               color: colours.warning },
  interest_accepted:      { name: 'checkmark-circle',   color: colours.success },
  verification_approved:  { name: 'shield-checkmark',   color: colours.success },
  verification_rejected:  { name: 'shield-outline',     color: '#EF4444' },
  subscription_expiring:  { name: 'time',               color: colours.warning },
  profile_view:           { name: 'eye',                color: colours.textMuted },
  report_reviewed:        { name: 'flag',               color: colours.warning },
  system:                 { name: 'information-circle', color: colours.textMuted },
};

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
  const icon = ICON_MAP[item.type] ?? ICON_MAP.system;
  const relTime = formatRelativeTime(item.createdAt);

  return (
    <TouchableOpacity
      style={[styles.item, !item.isRead && styles.itemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityLabel={`${item.title}. ${item.isRead ? 'Read' : 'Unread'}. ${relTime}`}
      testID={`notification-item-${item.id}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: icon.color + '20' }]}>
        <Ionicons name={icon.name} size={22} color={icon.color} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.time}>{relTime}</Text>
      </View>
    </TouchableOpacity>
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
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
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
      <View style={styles.centered} testID="NotificationsScreen">
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="NotificationsScreen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread && (
          <TouchableOpacity
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            accessibilityLabel="Mark all notifications as read"
            testID="mark-all-read-button"
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
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
            colors={[colours.primary]}
            tintColor={colours.primary}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footerLoader} color={colours.primary} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={56} color={colours.textMuted} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>
              We'll let you know when you get a new match, message, or interest.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.surfaceCard,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    color: colours.textPrimary,
  },
  markAllText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colours.background,
  },
  itemUnread: {
    backgroundColor: colours.primaryLight,
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
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colours.textPrimary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colours.primary,
    marginLeft: spacing.sm,
  },
  body: {
    fontSize: typography.fontSize.xs,
    color: colours.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  time: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
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
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colours.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontSize: typography.fontSize.sm,
    color: colours.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
  },
});
