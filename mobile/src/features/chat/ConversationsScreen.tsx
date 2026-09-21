import React, { useCallback } from 'react';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import {
  View, FlatList, StyleSheet, RefreshControl,
} from 'react-native';
import Text from '../../components/ui/Text';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colours, type, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { Avatar, EmptyState as SharedEmpty, GoldLock, SkeletonRow } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { canUseChat } from '../../utils/entitlements';
import { useUIStore } from '../../stores/uiStore';
import { useSocket } from '../../hooks/useSocket';
import { getConversations } from '../../api/chat';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { Conversation, Message } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

interface ConversationCardProps {
  item: Conversation;
  /** ES5: free member without a grant on this pair — muted row, lock glyph. */
  locked?: boolean;
  onPress: () => void;
}

function ConversationCard({ item, locked = false, onPress }: ConversationCardProps) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { profile, lastMessage, unreadCount, isOnline } = item;
  const name = `${profile.firstName} ${profile.lastName}`;
  const unread = unreadCount > 0 && !locked;

  return (
    <PressableScale
      style={s.card}
      onPress={onPress}
      accessibilityLabel={`Chat with ${name}`}
      accessibilityRole="button"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      testID={`ConversationCard-${item.userId}`}
    >
      <Avatar uri={profile.profilePhoto} name={name} size={54} online={isOnline} verified={profile.isVerified} />

      <View style={[s.cardBody, locked && { opacity: 0.65 }]}>
        <View style={s.cardRow}>
          <Text variant="headline" color="fgStrong" style={s.cardName} numberOfLines={1}>
            {name}{locked ? '  ' : ''}
            {locked && <Ionicons name="lock-closed" size={12} color={c.textMuted} />}
          </Text>
          {lastMessage && <Text variant="caption" color={unread ? 'primary' : 'textMuted'}>{formatTime(lastMessage.createdAt)}</Text>}
        </View>
        <View style={s.cardRow}>
          <Text
            variant="footnote"
            color={unread ? 'textPrimary' : 'textMuted'}
            style={s.cardLast}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {locked ? 'Upgrade to open this conversation' : (lastMessage?.content ?? '—')}
          </Text>
          {unread && (
            <View style={s.badge}>
              <Text variant="micro" style={s.badgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
            </View>
          )}
        </View>
      </View>
    </PressableScale>
  );
}

export default function ConversationsScreen() {
  const tabClearance = useTabBarClearance();
  const { t } = useTranslation();
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  // Chat access is decided by the SERVER (requireChatAccess). This mirrors that
  // rule for display only — see utils/entitlements.ts. It used to read
  // `plan !== 'free'`, which ignored the free-chat-for-mutuals flag entirely, so
  // with the flag on the same member could chat on the website and was refused
  // here.
  const authUser = useAuthStore((st) => st.user);
  const hasPlus = canUseChat(authUser);

  const { data: conversations = [], isLoading, isError, isRefetching, refetch, error: convError } = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: getConversations,
    enabled: hasPlus,
    staleTime: 30_000,
    retry: (count, err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.response?.status === 403) return false;
      return count < 2;
    },
  });

  useSocket({
    onMessageReceived: (_msg: Message) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });

  // ES5: a free member with grants sees ALL mutual threads; rows without a
  // grant (replyWindow === null, no flag/paid access) render locked and open
  // the plans screen instead of a thread that would 403.
  const isFreeMember = (authUser?.subscriptionPlan ?? 'free') === 'free';
  const rowLocked = useCallback(
    (conv: Conversation) =>
      isFreeMember && !(authUser?.features?.freeChatForMutuals ?? false) && !conv.replyWindow,
    [isFreeMember, authUser]
  );

  const handlePress = useCallback(
    (conv: Conversation) => {
      if (rowLocked(conv)) {
        navigation.navigate('Subscription');
        return;
      }
      queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (old) =>
        old?.map((c) => (c.userId === conv.userId ? { ...c, unreadCount: 0 } : c)) ?? []
      );
      const name = `${conv.profile.firstName} ${conv.profile.lastName}`;
      navigation.navigate('ChatThread', {
        userId: conv.userId,
        name,
        photo: conv.profile.profilePhoto ?? undefined,
      });
    },
    [navigation, queryClient, rowLocked]
  );

  // A free member whose list-level access came from the free-reply flag but
  // who holds ZERO grants gets a server 403 — that is the classic gate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deniedByServer = (convError as any)?.response?.status === 403;

  if (!hasPlus || deniedByServer) {
    return (
      <Screen edges={['top']} style={s.container} testID="ConversationsUpgradeGate">
        <View style={s.header}>
          <Text variant="title1" color="fgStrong">{t('chat.title', 'Messages')}</Text>
        </View>
        <View style={{ flex: 1, padding: spacing.gutter, justifyContent: 'center' }}>
          <GoldLock
            title={t('chat.plusRequired', 'Chat is a Premium feature')}
            subtitle={t('chat.plusRequiredSub', 'Upgrade to message your matches directly.')}
            ctaLabel={t('chat.upgradeBtn', 'Upgrade to Premium')}
            onUnlock={() => navigation.navigate('Subscription')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} style={s.container} testID="ConversationsScreen">
      <View style={s.header}>
        <Text variant="title1" color="fgStrong">Messages</Text>
        <PressableScale
          onPress={() => navigation.navigate('FamilyGroups')}
          accessibilityLabel="Family groups"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="people-outline" size={24} color={c.accent} />
        </PressableScale>
      </View>
      {isLoading ? (
        <View testID="ConversationsLoading">
          {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </View>
      ) : isError && conversations.length === 0 ? (
        // Failed with nothing cached: a retryable error, never a fake empty
        // list. A 403 never reaches here (it renders the upgrade gate above).
        <View style={s.emptyContainer}>
          <SharedEmpty
            variant="error"
            icon="chatbubbles-outline"
            title={t('chat.loadErrorTitle', "Couldn't load conversations")}
            description={t('chat.loadErrorSub', 'Check your connection and try again.')}
            actionLabel={t('chat.retryBtn', 'Try again')}
            onAction={() => refetch()}
            testID="ConversationsScreen-error"
          />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => <ConversationCard item={item} locked={rowLocked(item)} onPress={() => handlePress(item)} />}
          ListEmptyComponent={
            <SharedEmpty
              icon="chatbubbles-outline"
              title={t('chat.emptyTitle', 'No conversations yet')}
              description={t('chat.emptySub', 'Start chatting with your mutual matches.')}
              actionLabel={t('chat.emptyAction', 'See your matches')}
              onAction={() => navigation.navigate('MainTabs', { screen: 'Matches' })}
            />
          }
          ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: c.hairline }]} />}
          contentContainerStyle={conversations.length === 0 ? s.emptyContainer : { paddingBottom: tabClearance }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[c.accent]} tintColor={c.accent} />}
        />
      )}
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter, paddingVertical: 8,
  },
  emptyContainer: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: spacing.gutter, paddingVertical: 11,
  },
  cardBody: { flex: 1, gap: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { flex: 1, marginRight: spacing.sm },
  cardLast: { flex: 1, marginRight: spacing.sm },
  badge: {
    backgroundColor: c.accent, borderRadius: borderRadius.pill,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#fff' },
  separator: { height: 0.5, backgroundColor: c.hairline, marginLeft: 54 + 13 + spacing.gutter },
});
