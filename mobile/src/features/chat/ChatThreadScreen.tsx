import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { unlockContact } from '../../api/matches';
import { getThread, sendMessage, editMessage, deleteMessage } from '../../api/chat';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { Message } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'ChatThread'>;

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

function canEdit(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 15 * 60 * 1000;
}

// ─── Typing indicator ───────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <View style={s.typingRow} testID="TypingIndicator">
      <View style={s.typingBubble}>
        <Text style={s.typingDots}>•••</Text>
      </View>
    </View>
  );
}

// ─── Read receipt ────────────────────────────────────────────────────────────
function ReadReceipt({ msg }: { msg: Message }) {
  if (msg.readAt) return <Ionicons name="checkmark-done" size={15} color="#fff" />;
  if (msg.deliveredAt) return <Ionicons name="checkmark-done" size={15} color="rgba(255,255,255,0.6)" />;
  return <Ionicons name="checkmark" size={15} color="rgba(255,255,255,0.6)" />;
}

// ─── Message bubble ──────────────────────────────────────────────────────────
interface BubbleProps {
  msg: Message;
  isOwn: boolean;
  onLongPress: () => void;
}

function MessageBubble({ msg, isOwn, onLongPress }: BubbleProps) {
  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[s.bubbleRow, isOwn ? s.bubbleRowOwn : s.bubbleRowTheirs]}
      testID={`Bubble-${msg.id}`}
      accessibilityLabel={`Message: ${msg.content}`}
    >
      <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleTheirs]}>
        <Text style={[s.bubbleText, isOwn ? s.bubbleTextOwn : s.bubbleTextTheirs]}>
          {msg.content}
        </Text>
        {msg.isEdited && (
          <Text style={[s.editedTag, isOwn ? s.editedTagOwn : s.editedTagTheirs]}>edited</Text>
        )}
        <View style={s.bubbleMeta}>
          <Text style={[s.msgTime, isOwn ? s.msgTimeOwn : s.msgTimeTheirs]}>
            {formatMsgTime(msg.createdAt)}
          </Text>
          {isOwn && <ReadReceipt msg={msg} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Date separator ──────────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <View style={s.dateSep}>
      <View style={s.dateLine} />
      <Text style={s.dateLabel}>{label}</Text>
      <View style={s.dateLine} />
    </View>
  );
}

// ─── Contact unlock banner ───────────────────────────────────────────────────
interface ContactBannerProps {
  userId: string;
  onUnlocked: (phone: string) => void;
}

function ContactUnlockBanner({ userId, onUnlocked }: ContactBannerProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState<string | null>(null);

  const { mutate: unlock, isPending } = useMutation({
    mutationFn: () => unlockContact(userId),
    onSuccess: (res) => {
      setPhone(res.phone);
      onUnlocked(res.phone);
    },
    onError: () => {
      Alert.alert(t('error', 'Error'), t('chat.unlockFailed', 'Could not unlock contact. Check your quota.'));
    },
  });

  const handleUnlock = () => {
    Alert.alert(
      t('chat.unlockTitle', 'Unlock Contact?'),
      t('chat.unlockConfirm', 'This will use 1 contact unlock from your quota.'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        { text: t('chat.unlock', 'Unlock'), onPress: () => unlock() },
      ]
    );
  };

  if (phone) {
    return (
      <View style={s.contactBanner} testID="ContactBannerUnlocked">
        <Ionicons name="call" size={16} color={colours.success} />
        <Text style={s.contactPhone}>{phone}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={s.contactBanner}
      onPress={handleUnlock}
      disabled={isPending}
      accessibilityLabel={t('chat.requestContact', 'Request Contact')}
      testID="ContactUnlockBanner"
    >
      <Ionicons name="person-add-outline" size={16} color={colours.primary} />
      <Text style={s.contactBannerText}>{t('chat.requestContact', 'Request Contact')}</Text>
      {isPending && <ActivityIndicator size="small" color={colours.primary} style={{ marginLeft: 8 }} />}
    </TouchableOpacity>
  );
}

// ─── Message action menu ─────────────────────────────────────────────────────
interface ActionMenuProps {
  msg: Message | null;
  isOwn: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit: (msg: Message) => void;
  onDelete: (msg: Message) => void;
  onReport: (msg: Message) => void;
}

function MessageActionMenu({ msg, isOwn, visible, onClose, onEdit, onDelete, onReport }: ActionMenuProps) {
  const { t } = useTranslation();
  if (!msg) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.menuOverlay} onPress={onClose}>
        <View style={s.menuCard}>
          {isOwn && canEdit(msg.createdAt) && (
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { onEdit(msg); onClose(); }}
              testID="MenuEdit"
            >
              <Ionicons name="pencil" size={18} color={colours.textPrimary} />
              <Text style={s.menuItemText}>{t('chat.edit', 'Edit')}</Text>
            </TouchableOpacity>
          )}
          {isOwn && (
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { onDelete(msg); onClose(); }}
              testID="MenuDelete"
            >
              <Ionicons name="trash" size={18} color={colours.error} />
              <Text style={[s.menuItemText, { color: colours.error }]}>{t('chat.delete', 'Delete')}</Text>
            </TouchableOpacity>
          )}
          {!isOwn && (
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { onReport(msg); onClose(); }}
              testID="MenuReport"
            >
              <Ionicons name="flag" size={18} color={colours.warning} />
              <Text style={[s.menuItemText, { color: colours.warning }]}>{t('chat.report', 'Report')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChatThreadScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId, name, photo } = route.params;

  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { emitTyping, emitSeen } = useSocket({
    onTypingIndicator: (data) => {
      if (data.userId === userId) {
        setIsOtherTyping(data.isTyping);
        if (data.isTyping) {
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setIsOtherTyping(false), 5000);
        }
      }
    },
    onMessageReceived: (msg) => {
      if (msg.senderId === userId) {
        emitSeen(msg.id);
      }
    },
  });

  // Load thread (cursor-based, scroll up = load more)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: queryKeys.thread(userId),
    queryFn: ({ pageParam }) => getThread(userId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  // Flatten pages; pages[0] = newest page (inverted FlatList shows newest at bottom)
  const messages: Message[] = data?.pages.flatMap((p) => p.messages) ?? [];

  // Send message
  const { mutate: doSend, isPending: isSending } = useMutation({
    mutationFn: (content: string) => sendMessage(userId, content),
    onMutate: async (content) => {
      const optimistic: Message = {
        id: `tmp-${Date.now()}`,
        senderId: user!.id,
        receiverId: userId,
        content,
        isRead: false,
        deliveredAt: null,
        readAt: null,
        isEdited: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
        queryKeys.thread(userId),
        (old) => {
          if (!old) return { pages: [{ messages: [optimistic], nextCursor: null }], pageParams: [undefined] };
          const pages = [...old.pages];
          pages[0] = { ...pages[0], messages: [optimistic, ...pages[0].messages] };
          return { ...old, pages };
        }
      );
      return { optimistic };
    },
    onError: (_err, _content, ctx) => {
      // Remove optimistic message on failure
      if (ctx?.optimistic) {
        queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
          queryKeys.thread(userId),
          (old) => {
            if (!old) return old;
            const pages = old.pages.map((page) => ({
              ...page,
              messages: page.messages.filter((m) => m.id !== ctx.optimistic.id),
            }));
            return { ...old, pages };
          }
        );
      }
    },
    onSuccess: (realMsg, _content, ctx) => {
      // Replace optimistic with real message
      queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
        queryKeys.thread(userId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === ctx?.optimistic.id ? realMsg : m
            ),
          }));
          return { ...old, pages };
        }
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });

  // Edit message
  const { mutate: doEdit } = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => editMessage(id, content),
    onSuccess: (updated) => {
      queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
        queryKeys.thread(userId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => (m.id === updated.id ? updated : m)),
          }));
          return { ...old, pages };
        }
      );
    },
  });

  // Delete message
  const { mutate: doDelete } = useMutation({
    mutationFn: ({ id, forBoth }: { id: string; forBoth: boolean }) => deleteMessage(id, forBoth),
    onSuccess: (_r, vars) => {
      queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
        queryKeys.thread(userId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.filter((m) => m.id !== vars.id),
          }));
          return { ...old, pages };
        }
      );
    },
  });

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    if (editingMsg) {
      doEdit({ id: editingMsg.id, content: text });
      setEditingMsg(null);
    } else {
      doSend(text);
    }
    setInput('');
    emitTyping(userId, false);
  }, [input, editingMsg, doSend, doEdit, emitTyping, userId]);

  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);
      emitTyping(userId, text.length > 0);
    },
    [emitTyping, userId]
  );

  const handleDeletePrompt = useCallback(
    (msg: Message) => {
      Alert.alert(
        t('chat.deleteTitle', 'Delete Message?'),
        undefined,
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          { text: t('chat.deleteForMe', 'Delete for me'), onPress: () => doDelete({ id: msg.id, forBoth: false }) },
          { text: t('chat.deleteForAll', 'Delete for everyone'), style: 'destructive', onPress: () => doDelete({ id: msg.id, forBoth: true }) },
        ]
      );
    },
    [t, doDelete]
  );

  const handleReport = useCallback((_msg: Message) => {
    Alert.alert(t('chat.reportSent', 'Report submitted. Thank you.'));
  }, [t]);

  // Render list item with optional date separator
  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isOwn = item.senderId === user?.id;
      const prev = messages[index + 1];
      const showDate = !prev || !isSameDay(item.createdAt, prev.createdAt);

      return (
        <>
          {showDate && <DateSeparator label={formatDateSeparator(item.createdAt)} />}
          <MessageBubble
            msg={item}
            isOwn={isOwn}
            onLongPress={() => setSelectedMsg(item)}
          />
        </>
      );
    },
    [messages, user?.id]
  );

  const isOwn = selectedMsg ? selectedMsg.senderId === user?.id : false;

  if (isLoading) {
    return (
      <View style={s.center} testID="ChatThreadLoading">
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          accessibilityLabel={t('back', 'Back')}
          testID="BackBtn"
        >
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.headerProfile}
          onPress={() => navigation.navigate('ProfileDetail', { userId })}
          accessibilityLabel={`View ${name}'s profile`}
          testID="HeaderProfile"
        >
          {photo ? (
            <Image source={{ uri: photo }} style={s.headerAvatar} />
          ) : (
            <View style={[s.headerAvatar, s.headerAvatarFallback]}>
              <Text style={s.headerAvatarInitial}>{name[0]}</Text>
            </View>
          )}
          <Text style={s.headerName} numberOfLines={1}>{name}</Text>
        </TouchableOpacity>

        <View style={s.headerActions}>
          {/* Voice call — Premium+ gate stub */}
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => navigation.navigate('VoiceCall', { calleeId: userId, channelName: `voice_${userId}` })}
            accessibilityLabel={t('chat.voiceCall', 'Voice call')}
            testID="VoiceCallBtn"
          >
            <Ionicons name="call-outline" size={22} color={colours.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => navigation.navigate('VideoCall', { calleeId: userId, channelName: `video_${userId}`, callType: 'video' })}
            accessibilityLabel={t('chat.videoCall', 'Video call')}
            testID="VideoCallBtn"
          >
            <Ionicons name="videocam-outline" size={22} color={colours.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact unlock banner */}
      <ContactUnlockBanner userId={userId} onUnlocked={() => {}} />

      {/* Message list (inverted — newest at bottom) */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        inverted
        contentContainerStyle={s.listContent}
        onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.2}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator
              size="small"
              color={colours.primary}
              style={{ marginVertical: spacing.sm }}
            />
          ) : null
        }
        ListHeaderComponent={isOtherTyping ? <TypingIndicator /> : null}
      />

      {/* Edit banner */}
      {editingMsg && (
        <View style={s.editBanner} testID="EditBanner">
          <Ionicons name="pencil" size={14} color={colours.primary} />
          <Text style={s.editBannerText} numberOfLines={1}>{editingMsg.content}</Text>
          <TouchableOpacity onPress={() => { setEditingMsg(null); setInput(''); }}>
            <Ionicons name="close" size={18} color={colours.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={handleInputChange}
          placeholder={t('chat.typePlaceholder', 'Type a message…')}
          placeholderTextColor={colours.textMuted}
          multiline
          maxLength={2000}
          accessibilityLabel={t('chat.typePlaceholder', 'Type a message')}
          testID="MessageInput"
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || isSending) && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isSending}
          accessibilityLabel={t('chat.send', 'Send')}
          testID="SendBtn"
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Long-press action menu */}
      <MessageActionMenu
        msg={selectedMsg}
        isOwn={isOwn}
        visible={selectedMsg !== null}
        onClose={() => setSelectedMsg(null)}
        onEdit={(msg) => { setEditingMsg(msg); setInput(msg.content); }}
        onDelete={handleDeletePrompt}
        onReport={handleReport}
      />
    </KeyboardAvoidingView>
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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
    paddingBottom: 10,
    backgroundColor: colours.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  headerAvatarFallback: {
    backgroundColor: colours.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
  },
  headerName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerBtn: {
    padding: spacing.xs,
  },
  // Contact banner
  contactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colours.primaryLight + '30',
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  contactBannerText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.primary,
  },
  contactPhone: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.success,
  },
  // List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // Bubbles
  bubbleRow: {
    marginVertical: 2,
  },
  bubbleRowOwn: {
    alignItems: 'flex-end',
  },
  bubbleRowTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.lg,
  },
  bubbleOwn: {
    backgroundColor: colours.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colours.surfaceCard,
    borderWidth: 1,
    borderColor: colours.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  bubbleTextOwn: {
    color: '#fff',
  },
  bubbleTextTheirs: {
    color: colours.textPrimary,
  },
  editedTag: {
    fontSize: typography.fontSize.xs - 1,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  editedTagOwn: {
    color: 'rgba(255,255,255,0.6)',
  },
  editedTagTheirs: {
    color: colours.textMuted,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
  },
  msgTime: {
    fontSize: typography.fontSize.xs - 1,
    fontFamily: typography.fontFamily.regular,
  },
  msgTimeOwn: {
    color: 'rgba(255,255,255,0.65)',
  },
  msgTimeTheirs: {
    color: colours.textMuted,
  },
  receipt: {
    fontSize: typography.fontSize.xs,
    color: '#fff',
  },
  receiptGray: {
    color: 'rgba(255,255,255,0.5)',
  },
  // Date separator
  dateSep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: colours.border,
  },
  dateLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
  },
  // Typing indicator
  typingRow: {
    alignItems: 'flex-start',
    marginVertical: spacing.xs,
  },
  typingBubble: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colours.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  typingDots: {
    fontSize: typography.fontSize.lg,
    color: colours.textMuted,
    letterSpacing: 3,
  },
  // Edit banner
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colours.primaryLight + '20',
    borderTopWidth: 1,
    borderTopColor: colours.border,
  },
  editBannerText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.xs,
    backgroundColor: colours.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: colours.border,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colours.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colours.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colours.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colours.primaryLight,
    opacity: 0.5,
  },
  // Action menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs,
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuItemText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
});
