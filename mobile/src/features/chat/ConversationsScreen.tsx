import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import {
  View, FlatList, StyleSheet, RefreshControl, AccessibilityInfo,
} from 'react-native';
import Text, { type TextColor } from '../../components/ui/Text';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import TabHeader from '../../components/layout/TabHeader';
import RowSeparator from '../../components/ui/RowSeparator';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { FREE_REPLY_MAX_MESSAGES, FREE_REPLY_WINDOW_MS } from '@shared/constants/chat';
import { Avatar, EmptyState as SharedEmpty, GoldLock, SkeletonRow } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { canUseChat } from '../../utils/entitlements';
import { useSocket } from '../../hooks/useSocket';
import { getConversations } from '../../api/chat';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { Conversation, Message } from '../../types';
import { LIST_PERF } from '../../constants/listPerf';
import { tapSize } from '../../utils/elderTheme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const NO_CONVERSATIONS: Conversation[] = [];

/** "Priya Sharma", or just "Priya" when there is no surname (app signups have none). */
const fullName = (p: { firstName?: string | null; lastName?: string | null }): string =>
  [p.firstName, p.lastName].filter(Boolean).join(' ');

function formatTime(iso: string, yesterday: string): string {
  const d = new Date(iso);
  const now = new Date();
  // Calendar days, not elapsed hours: last night's message is "Yesterday" this
  // morning, not a bare clock time that reads as today's.
  const startOfMsgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfMsgDay) / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return yesterday;
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

interface ConversationCardProps {
  item: Conversation;
  /** ES5: free member without a grant on this pair — muted row, lock glyph. */
  locked?: boolean;
  /**
   * The server's free-reply window is on (`features.freeReplyWindow`). It decides
   * which lock copy is true: with it on, a free member can READ everything and
   * REPLY inside a window, so "upgrade to open" would be a lie; what Premium buys
   * them is writing first.
   */
  freeReply?: boolean;
  onPress: () => void;
}

function ConversationCard({ item, locked = false, freeReply = false, onPress }: ConversationCardProps) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const s = getS(c);
  const { profile, lastMessage, unreadCount, isOnline } = item;
  const name = fullName(profile);
  const unread = unreadCount > 0 && !locked;

  // "—" used to stand in for "no message yet", and a voice note showed its
  // empty content string. Say what it is. An empty thread is an invitation, not a
  // status: "No messages yet" told the member nothing they could act on.
  const sayHello = !locked && !lastMessage;
  const first = profile.firstName?.trim() || name.split(' ')[0] || t('chat.yourMatch', 'your match');
  let preview: string;
  if (locked) {
    preview = freeReply
      ? t('chat.lockedPreviewFreeReply', 'Write first with Premium')
      : t('chat.lockedPreview', 'Upgrade to open this conversation');
  } else if (!lastMessage) {
    preview = t('chat.sayHelloRow', 'Say hello to {{first}}', { first });
  } else {
    preview = lastMessage.messageType === 'voice' ? t('chat.voiceMessage', 'Voice message') : lastMessage.content;
  }
  const previewColour: TextColor = unread ? 'textPrimary' : sayHello ? 'primary' : 'textMuted';
  const time = lastMessage ? formatTime(lastMessage.createdAt, t('chat.yesterday', 'Yesterday')) : '';

  // One spoken summary per row: who, whether there is something new, what it
  // says, when. (It was just "Chat with <name>".)
  const label = [
    name,
    unread ? t('chat.a11yUnread', '{{count}} unread', { count: unreadCount }) : '',
    preview,
    time,
  ].filter(Boolean).join('. ');

  return (
    <PressableScale
      style={s.card}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={locked ? t('chat.a11yLockedHint', 'Opens the plans screen') : t('chat.a11yOpenHint', 'Opens the conversation')}
      accessibilityRole="button"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      testID={`ConversationCard-${item.userId}`}
    >
      <Avatar uri={profile.profilePhoto} name={name} size={54} online={isOnline} verified={profile.isVerified} />

      <View style={s.cardBody}>
        <View style={s.cardRow}>
          <View style={s.nameRow}>
            <Text variant="headline" color={locked ? 'textSecondary' : 'fgStrong'} style={s.cardName} numberOfLines={2}>
              {name}
            </Text>
            {locked && <Ionicons name="lock-closed" size={12} color={c.textMuted} />}
          </View>
          {lastMessage && <Text variant="caption" color={unread ? 'primary' : 'textMuted'} maxScale={1.2}>{time}</Text>}
        </View>
        <View style={s.cardRow}>
          <Text
            variant="footnote"
            color={previewColour}
            style={s.cardLast}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {preview}
          </Text>
          {unread && (
            <View style={s.badge}>
              {/* The badge is a fixed 20pt pill: cap OS text scaling inside it. */}
              <Text variant="micro" color="onPrimary" maxScale={1.3}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
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
  const { c, elder } = useTheme();
  const s = getS(c);
  const tap = tapSize(elder);
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  // Chat access is decided by the SERVER (requireChatAccess). This mirrors that
  // rule for display only — see utils/entitlements.ts. It used to read
  // `plan !== 'free'`, which ignored the free-chat-for-mutuals flag entirely, so
  // with the flag on the same member could chat on the website and was refused
  // here.
  const authUser = useAuthStore((st) => st.user);
  const hasPlus = canUseChat(authUser);
  // The gate and the locked-row copy must not deny what the free-reply window
  // grants. Absent `features` (an older server) reads as off, which keeps the
  // classic wording.
  const freeReply = authUser?.features?.freeReplyWindow === true;

  const { data, isLoading, isError, refetch, error: convError } = useQuery({
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

  // A stable empty list: `data = []` in the destructure is a fresh array every
  // render while the query is loading.
  const conversations = data ?? NO_CONVERSATIONS;

  // The pull-to-refresh spinner belongs to the gesture that asked for it. It used
  // to follow the query's own `isRefetching`, so every socket-driven invalidate
  // and every refocus drew the spinner with nobody pulling.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // A new message reorders the list and bumps a badge with no tap. Sighted users
  // see that; a screen reader is told. Watched off the cache (which useSocket
  // writes on every incoming message whichever screen made the socket) rather than
  // off a socket handler, and only while this tab is the one in front.
  const isFocused = useIsFocused();
  const seenUnread = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    // The first snapshot is the baseline, never an announcement: whatever was
    // already unread when the list loaded is not "new".
    if (!data) return;
    const next = new Map<string, number>(data.map((cv): [string, number] => [cv.userId, cv.unreadCount ?? 0]));
    const prev = seenUnread.current;
    seenUnread.current = next;
    if (!prev || !isFocused) return;
    const grew = data.find((cv) => (cv.unreadCount ?? 0) > (prev.get(cv.userId) ?? 0));
    if (grew) {
      AccessibilityInfo.announceForAccessibility(
        t('chat.a11yNewMessageFrom', 'New message from {{name}}', { name: fullName(grew.profile) })
      );
    }
  }, [data, isFocused, t]);

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
      const name = fullName(conv.profile);
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
        <TabHeader title={t('chat.title', 'Messages')} />
        <View style={{ flex: 1, padding: spacing.gutter, justifyContent: 'center' }}>
          {freeReply ? (
            // The free-reply window is on: reading is free and a reply is allowed
            // once a Premium member writes first, so "Chat is a Premium feature"
            // would deny what the product promises. State what Premium adds.
            <GoldLock
              title={t('chat.gateFreeReplyTitle', 'Sending the first message needs Premium')}
              subtitle={t(
                'chat.gateFreeReplyBody',
                'You can always read messages you receive. When a Premium member writes first, you can reply {{count}} times over {{hours}} hours.',
                { count: FREE_REPLY_MAX_MESSAGES, hours: Math.round(FREE_REPLY_WINDOW_MS / 3_600_000) }
              )}
              ctaLabel={t('chat.gateFreeReplyCta', 'See Premium')}
              onUnlock={() => navigation.navigate('Subscription')}
            />
          ) : (
            <GoldLock
              title={t('chat.plusRequired', 'Chat is a Premium feature')}
              subtitle={t('chat.plusRequiredSub', 'Upgrade to message your matches directly.')}
              ctaLabel={t('chat.upgradeBtn', 'Upgrade to Premium')}
              onUnlock={() => navigation.navigate('Subscription')}
            />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} style={s.container} testID="ConversationsScreen">
      <TabHeader
        title={t('chat.title', 'Messages')}
        trailing={
          // A real 48pt (60 elder) box rather than a 24pt icon with hitSlop;
          // TabHeader pulls it into the gutter so the glyph sits on the gutter line.
          <PressableScale
            onPress={() => navigation.navigate('FamilyGroups')}
            style={[s.headerBtn, { width: tap, height: tap }]}
            accessibilityLabel={t('chat.familyGroups', 'Family groups')}
            accessibilityRole="button"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="FamilyGroupsBtn"
          >
            <Ionicons name="people-outline" size={24} color={c.accent} />
          </PressableScale>
        }
      />
      {isLoading ? (
        // Silent for a screen reader otherwise: say what is loading.
        <View
          testID="ConversationsLoading"
          accessible
          accessibilityLabel={t('chat.loadingConversations', 'Loading conversations')}
          accessibilityState={{ busy: true }}
        >
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
          {...LIST_PERF}
          data={conversations}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <ConversationCard item={item} locked={rowLocked(item)} freeReply={freeReply} onPress={() => handlePress(item)} />
          )}
          ListEmptyComponent={
            <SharedEmpty
              icon="chatbubbles-outline"
              title={t('chat.emptyTitle', 'No conversations yet')}
              description={t('chat.emptySub', 'Start chatting with your mutual matches.')}
              actionLabel={t('chat.emptyAction', 'See your matches')}
              onAction={() => navigation.navigate('MainTabs', { screen: 'Matches' })}
            />
          }
          ItemSeparatorComponent={RowSeparator}
          contentContainerStyle={conversations.length === 0 ? s.emptyContainer : { paddingBottom: tabClearance }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.accent]} tintColor={c.accent} />}
        />
      )}
    </Screen>
  );
}

// Built once per palette, not once per row: every ConversationCard asked for its
// own copy, and rows remount as they scroll. `c` is
// always the `colours` / `darkColours` singleton from useTheme().
const sheetsByPalette = new WeakMap<ThemeColours, ReturnType<typeof makeS>>();
function getS(c: ThemeColours): ReturnType<typeof makeS> {
  let sheet = sheetsByPalette.get(c);
  if (!sheet) {
    sheet = makeS(c);
    sheetsByPalette.set(c, sheet);
  }
  return sheet;
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container: { flex: 1 },
  // Size (48 / 60 elder) is applied inline. TabHeader owns the gutter pull.
  headerBtn: { alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: spacing.gutter, paddingVertical: 11,
  },
  cardBody: { flex: 1, gap: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: spacing.sm },
  cardName: { flexShrink: 1 },
  cardLast: { flex: 1, marginRight: spacing.sm },
  // p500 (#8B2346 in both palettes) rather than c.accent: in dark mode accent is
  // the lighter #C75D7E, and white on it is ~3.96:1, under AA at this size.
  badge: {
    backgroundColor: c.p500, borderRadius: borderRadius.pill,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
});
