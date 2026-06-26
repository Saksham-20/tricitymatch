import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colours, type, spacing, borderRadius } from '@shared/constants/theme';
import { Avatar, EmptyState as SharedEmpty, GoldLock, SkeletonRow } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, selectPlan } from '../../stores/authStore';
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
  onPress: () => void;
}

function ConversationCard({ item, onPress }: ConversationCardProps) {
  const { c } = useTheme();
  const { profile, lastMessage, unreadCount, isOnline } = item;
  const name = `${profile.firstName} ${profile.lastName}`;
  const unread = unreadCount > 0;

  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      accessibilityLabel={`Chat with ${name}`}
      testID={`ConversationCard-${item.userId}`}
    >
      <Avatar uri={profile.profilePhoto} name={name} size={54} online={isOnline} verified={profile.isVerified} />

      <View style={s.cardBody}>
        <View style={s.cardRow}>
          <Text style={[s.cardName, { color: c.fgStrong }, unread && s.bold]} numberOfLines={1}>{name}</Text>
          {lastMessage && <Text style={[s.cardTime, { color: unread ? c.accent : c.textMuted }]}>{formatTime(lastMessage.createdAt)}</Text>}
        </View>
        <View style={s.cardRow}>
          <Text
            style={[s.cardLast, { color: unread ? c.textPrimary : c.textMuted }, unread && s.semibold]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {lastMessage?.content ?? '—'}
          </Text>
          {unread && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ConversationsScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Chat is gated to paid plans (mirrors web's requirePremium). Any non-free tier unlocks it.
  const hasPlus = useAuthStore(selectPlan) !== 'free';

  const { data: conversations = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: getConversations,
    enabled: hasPlus,
    staleTime: 30_000,
  });

  useSocket({
    onMessageReceived: (_msg: Message) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });

  const handlePress = useCallback(
    (conv: Conversation) => {
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
    [navigation, queryClient]
  );

  if (!hasPlus) {
    return (
      <View style={[s.container, { backgroundColor: c.background, paddingTop: insets.top }]} testID="ConversationsUpgradeGate">
        <View style={s.header}>
          <Text style={[s.headerTitle, { color: c.fgStrong }]}>{t('chat.title', 'Messages')}</Text>
        </View>
        <View style={{ flex: 1, padding: spacing.gutter, justifyContent: 'center' }}>
          <GoldLock
            title={t('chat.plusRequired', 'Chat is a Premium feature')}
            subtitle={t('chat.plusRequiredSub', 'Upgrade to message your matches directly.')}
            ctaLabel={t('chat.upgradeBtn', 'Upgrade to Premium')}
            onUnlock={() => navigation.navigate('Subscription')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: c.background, paddingTop: insets.top }]} testID="ConversationsScreen">
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: c.fgStrong }]}>Messages</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('FamilyGroups')}
          accessibilityLabel="Family groups"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="people-outline" size={24} color={c.accent} />
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View testID="ConversationsLoading">
          {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => <ConversationCard item={item} onPress={() => handlePress(item)} />}
          ListEmptyComponent={
            <SharedEmpty
              icon="chatbubbles-outline"
              title={t('chat.emptyTitle', 'No conversations yet')}
              description={t('chat.emptySub', 'Start chatting with your mutual matches.')}
            />
          }
          ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: c.hairline }]} />}
          contentContainerStyle={conversations.length === 0 ? s.emptyContainer : undefined}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[c.accent]} tintColor={c.accent} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter, paddingVertical: 8,
  },
  headerTitle: { ...type.title1, fontFamily: 'PlayfairDisplay-Bold' },
  emptyContainer: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: spacing.gutter, paddingVertical: 11,
  },
  cardBody: { flex: 1, gap: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { ...type.headline, flex: 1, marginRight: spacing.sm },
  cardTime: { ...type.caption },
  cardLast: { ...type.footnote, flex: 1, marginRight: spacing.sm },
  bold: { fontFamily: 'Inter-Bold' },
  semibold: { fontFamily: 'Inter-SemiBold' },
  badge: {
    backgroundColor: colours.accent, borderRadius: borderRadius.pill,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { ...type.micro, color: '#fff' },
  separator: { height: 0.5, backgroundColor: colours.hairline, marginLeft: 54 + 13 + spacing.gutter },
});
