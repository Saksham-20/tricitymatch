import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { useAuthStore } from '../../stores/authStore';
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

function UpgradeGate() {
  const { t } = useTranslation();
  const { showUpgradeModal } = useUIStore();
  return (
    <View style={s.gate} testID="ConversationsUpgradeGate">
      <Ionicons name="lock-closed" size={48} color={colours.textMuted} />
      <Text style={s.gateTitle}>{t('chat.plusRequired', 'Chat is a Plus+ Feature')}</Text>
      <Text style={s.gateSub}>{t('chat.plusRequiredSub', 'Upgrade to message your matches directly')}</Text>
      <TouchableOpacity
        style={s.upgradeBtn}
        onPress={() => showUpgradeModal('premium_plus')}
        accessibilityLabel={t('chat.upgradeBtn', 'Upgrade to Plus')}
        testID="UpgradeBtn"
      >
        <Text style={s.upgradeBtnText}>{t('chat.upgradeBtn', 'Upgrade to Plus')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <View style={s.empty} testID="ConversationsEmpty">
      <Ionicons name="chatbubbles-outline" size={56} color={colours.textMuted} />
      <Text style={s.emptyTitle}>{t('chat.emptyTitle', 'No conversations yet')}</Text>
      <Text style={s.emptySub}>{t('chat.emptySub', 'Start chatting with your mutual matches')}</Text>
    </View>
  );
}

interface ConversationCardProps {
  item: Conversation;
  onPress: () => void;
}

function ConversationCard({ item, onPress }: ConversationCardProps) {
  const { profile, lastMessage, unreadCount, isOnline } = item;
  const name = `${profile.firstName} ${profile.lastName}`;

  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      accessibilityLabel={`Chat with ${name}`}
      testID={`ConversationCard-${item.userId}`}
    >
      <View style={s.avatarWrap}>
        {profile.profilePhoto ? (
          <Image source={{ uri: profile.profilePhoto }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitial}>{profile.firstName[0]}</Text>
          </View>
        )}
        {isOnline && <View style={s.onlineDot} />}
        {profile.isVerified && (
          <View style={s.verifiedDot}>
            <Ionicons name="checkmark-circle" size={14} color={colours.success} />
          </View>
        )}
      </View>

      <View style={s.cardBody}>
        <View style={s.cardRow}>
          <Text style={[s.cardName, unreadCount > 0 && s.cardNameBold]} numberOfLines={1}>
            {name}
          </Text>
          {lastMessage && (
            <Text style={s.cardTime}>{formatTime(lastMessage.createdAt)}</Text>
          )}
        </View>
        <View style={s.cardRow}>
          <Text
            style={[s.cardLast, unreadCount > 0 && s.cardLastBold]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {lastMessage?.content ?? '—'}
          </Text>
          {unreadCount > 0 && (
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
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  // Placeholder: real subscription check wired in session 11
  const hasPlus = false;

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

  if (!hasPlus) return <UpgradeGate />;

  if (isLoading) {
    return (
      <View style={s.center} testID="ConversationsLoading">
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  return (
    <View style={s.container} testID="ConversationsScreen">
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <ConversationCard
            item={item}
            onPress={() => handlePress(item)}
          />
        )}
        ListEmptyComponent={<EmptyState />}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        contentContainerStyle={conversations.length === 0 ? s.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[colours.primary]}
            tintColor={colours.primary}
          />
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.background,
  },
  emptyContainer: {
    flex: 1,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colours.background,
    gap: spacing.md,
  },
  gateTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    textAlign: 'center',
  },
  gateSub: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
    textAlign: 'center',
  },
  upgradeBtn: {
    marginTop: spacing.sm,
    backgroundColor: colours.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  upgradeBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  emptySub: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colours.background,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    marginRight: spacing.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    backgroundColor: colours.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colours.success,
    borderWidth: 2,
    borderColor: colours.background,
  },
  verifiedDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: colours.background,
    borderRadius: 8,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    marginRight: spacing.sm,
  },
  cardNameBold: {
    fontFamily: typography.fontFamily.bold,
  },
  cardTime: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
  },
  cardLast: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
    marginRight: spacing.sm,
  },
  cardLastBold: {
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
  },
  badge: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: typography.fontSize.xs - 1,
    fontFamily: typography.fontFamily.bold,
    color: '#fff',
  },
  separator: {
    height: 1,
    backgroundColor: colours.border,
    marginLeft: 52 + spacing.md + spacing.sm,
  },
});
