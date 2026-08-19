import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import SmartImage from '../../components/common/SmartImage';
import { PressableScale, useReduceMotion } from '../../components/motion';
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { duration } from '@shared/constants/motion';
import { ChatThreadSkeleton } from '../../components/ui/skeletons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '../../utils/toast';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { unlockContact } from '../../api/matches';
import { getThread, sendMessage, editMessage, deleteMessage, sendVoiceMessage, toggleReaction } from '../../api/chat';
import { VoiceRecorderStrip, VoiceMessageBubble } from './VoiceMessage';
import { REACTION_EMOJIS } from '@shared/constants/chat';
import type { ReplyWindow } from '@shared/types/chat';
import { getProfile } from '../../api/profile';
import { CONFIG } from '../../constants/config';
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

// ─── Typing indicator — 3 dots bouncing on a 1.2s loop (handoff spec) ───────
function TypingDot({ delay }: { delay: number }) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const reduced = useReduceMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 300, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(y);
  }, [reduced, delay, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[s.typingDot, st]} />;
}

function TypingIndicator() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <View style={s.typingRow} testID="TypingIndicator">
      <View style={s.typingBubble}>
        <View style={s.typingDotsRow}>
          <TypingDot delay={0} />
          <TypingDot delay={150} />
          <TypingDot delay={300} />
        </View>
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
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const reduced = useReduceMotion();
  // Optimistic sends render at half opacity until the server ack swaps in
  // the real message (id no longer tmp-*).
  const pending = msg.id.startsWith('tmp-');
  // Entrance only for messages created in the last few seconds — history
  // must never re-animate when pages load or the list re-renders.
  const isFresh = Date.now() - new Date(msg.createdAt).getTime() < 3000;
  const entering = !reduced && isFresh ? FadeInDown.duration(duration.fast * 1.5) : undefined;
  return (
    <Animated.View entering={entering}>
    <TouchableOpacity
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[s.bubbleRow, isOwn ? s.bubbleRowOwn : s.bubbleRowTheirs, pending && { opacity: 0.5 }]}
      testID={`Bubble-${msg.id}`}
      accessibilityLabel={`Message: ${msg.content}`}
    >
      <View>
        <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleTheirs]}>
          {msg.ReplyTo && (
            <View style={[s.quoteBlock, isOwn ? s.quoteBlockOwn : s.quoteBlockTheirs]}>
              <Text style={[s.quoteText, isOwn && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={2}>
                {msg.ReplyTo.messageType === 'voice' ? 'Voice message' : msg.ReplyTo.content}
              </Text>
            </View>
          )}
          {msg.messageType === 'voice' ? (
            <VoiceMessageBubble uri={msg.mediaUrl} durationMs={msg.mediaDurationMs} own={isOwn} />
          ) : (
            <Text style={[s.bubbleText, isOwn ? s.bubbleTextOwn : s.bubbleTextTheirs]}>
              {msg.content}
            </Text>
          )}
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
        {Object.keys(msg.reactions || {}).length > 0 && (
          <View style={[s.reactionRow, isOwn && { alignSelf: 'flex-end' }]}>
            {Object.entries(msg.reactions).filter(([, u]) => u?.length).map(([emoji, users]) => (
              <View key={emoji} style={s.reactionPill}>
                <Text style={s.reactionEmoji}>{emoji}</Text>
                {users.length > 1 && <Text style={s.reactionCount}>{users.length}</Text>}
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Date separator ──────────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
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
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { t } = useTranslation();
  const [phone, setPhone] = useState<string | null>(null);

  const { mutate: unlock, isPending } = useMutation({
    mutationFn: () => unlockContact(userId),
    onSuccess: (res) => {
      setPhone(res.phone);
      onUnlocked(res.phone);
    },
    onError: () => {
      showToast.error(t('error', 'Error'), t('chat.unlockFailed', 'Could not unlock contact. Check your quota.'));
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
        <Ionicons name="call" size={16} color={c.success} />
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
      <Ionicons name="person-add-outline" size={16} color={c.primary} />
      <Text style={s.contactBannerText}>{t('chat.requestContact', 'Request Contact')}</Text>
      {isPending && <ActivityIndicator size="small" color={c.primary} style={{ marginLeft: 8 }} />}
    </TouchableOpacity>
  );
}

// ─── Message action menu ─────────────────────────────────────────────────────
interface ActionMenuProps {
  msg: Message | null;
  isOwn: boolean;
  visible: boolean;
  canRich: boolean;
  onClose: () => void;
  onEdit: (msg: Message) => void;
  onDelete: (msg: Message) => void;
  onReport: (msg: Message) => void;
  onReact: (msg: Message, emoji: string) => void;
  onReply: (msg: Message) => void;
}

function MessageActionMenu({ msg, isOwn, visible, canRich, onClose, onEdit, onDelete, onReport, onReact, onReply }: ActionMenuProps) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { t } = useTranslation();
  if (!msg) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.menuOverlay} onPress={onClose}>
        <View style={s.menuCard}>
          {/* D2 reactions — premium; six-emoji allowlist mirrors the server */}
          {canRich && (
            <View style={s.emojiRow}>
              {REACTION_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => { onReact(msg, e); onClose(); }}
                  style={s.emojiBtn}
                  accessibilityLabel={`React ${e}`}
                  testID={`React-${e}`}
                >
                  <Text style={s.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {canRich && (
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { onReply(msg); onClose(); }}
              testID="MenuReply"
            >
              <Ionicons name="return-up-back" size={18} color={c.textPrimary} />
              <Text style={s.menuItemText}>{t('chat.reply', 'Reply')}</Text>
            </TouchableOpacity>
          )}
          {isOwn && canEdit(msg.createdAt) && (
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { onEdit(msg); onClose(); }}
              testID="MenuEdit"
            >
              <Ionicons name="pencil" size={18} color={c.textPrimary} />
              <Text style={s.menuItemText}>{t('chat.edit', 'Edit')}</Text>
            </TouchableOpacity>
          )}
          {isOwn && (
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { onDelete(msg); onClose(); }}
              testID="MenuDelete"
            >
              <Ionicons name="trash" size={18} color={c.error} />
              <Text style={[s.menuItemText, { color: c.error }]}>{t('chat.delete', 'Delete')}</Text>
            </TouchableOpacity>
          )}
          {!isOwn && (
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { onReport(msg); onClose(); }}
              testID="MenuReport"
            >
              <Ionicons name="flag" size={18} color={c.warning} />
              <Text style={[s.menuItemText, { color: c.warning }]}>{t('chat.report', 'Report')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChatThreadScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId, name: nameParam, photo: photoParam , draft } = route.params;

  // Callers that only know the other user's id — a "new message" notification
  // tap, for one — navigate here with an empty name, which rendered a chat with
  // a blank header. Fall back to fetching the profile so the header is correct
  // regardless of who navigated.
  const { data: fallbackProfile } = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getProfile(userId),
    enabled: !nameParam,
    staleTime: 5 * 60 * 1000,
  });

  const name =
    nameParam ||
    [fallbackProfile?.firstName, fallbackProfile?.lastName].filter(Boolean).join(' ') ||
    '';
  const photo = photoParam ?? fallbackProfile?.profilePhoto ?? undefined;

  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [input, setInput] = useState(draft ?? '');
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  // D1: live window state — seeded from the thread response, advanced by every
  // send, and flipped inactive by the local expiry timer (403 is the backstop).
  const [replyWindow, setReplyWindow] = useState<ReplyWindow | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPaid = (user?.subscriptionPlan ?? 'free') !== 'free';

  const { emitTyping, joinThread, leaveThread } = useSocket({
    onTypingIndicator: (data) => {
      if (data.userId === userId) {
        setIsOtherTyping(data.isTyping);
        if (data.isTyping) {
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setIsOtherTyping(false), 5000);
        }
      }
    },
  });

  // Join the pair room so the server-authoritative broadcasts reach this device.
  useEffect(() => {
    joinThread(userId);
    return () => leaveThread(userId);
  }, [userId, joinThread, leaveThread]);

  // Load thread (cursor-based, scroll up = load more)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error: threadError,
  } = useInfiniteQuery({
    queryKey: queryKeys.thread(userId),
    queryFn: ({ pageParam }) => getThread(userId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: (count, err) => {
      // 403 = no chat access for this thread — a real state, not a flake.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.response?.status === 403) return false;
      return count < 2;
    },
  });

  const chatAccess = data?.pages?.[0]?.chatAccess ?? null;
  const isGrantThread = chatAccess?.reason === 'free_reply_window';

  // Seed the live window from the thread response.
  useEffect(() => {
    if (chatAccess?.replyWindow) setReplyWindow(chatAccess.replyWindow);
  }, [chatAccess?.replyWindow]);

  // Local expiry timer (DS): flip inactive the moment expiresAt passes.
  useEffect(() => {
    if (!replyWindow?.active || !replyWindow.expiresAt) return undefined;
    const ms = new Date(replyWindow.expiresAt).getTime() - Date.now();
    if (ms <= 0) { setReplyWindow((w) => (w ? { ...w, active: false } : w)); return undefined; }
    const tmr = setTimeout(() => setReplyWindow((w) => (w ? { ...w, active: false } : w)), ms);
    return () => clearTimeout(tmr);
  }, [replyWindow?.active, replyWindow?.expiresAt]);

  // Flatten pages; pages[0] = newest page (inverted FlatList shows newest at bottom)
  const messages: Message[] = data?.pages.flatMap((p) => p.messages) ?? [];

  // Send message
  const { mutate: doSend, isPending: isSending } = useMutation({
    mutationFn: (content: string) => sendMessage(userId, content, replyingTo?.id),
    onMutate: async (content) => {
      const optimistic: Message = {
        id: `tmp-${Date.now()}`,
        senderId: user!.id,
        receiverId: userId,
        content,
        messageType: 'text',
        mediaUrl: null,
        mediaDurationMs: null,
        replyToId: null,
        reactions: {},
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
    onError: (err, _content, ctx) => {
      // 403 backstop: trust the server's window state; the paywalled composer
      // takes over.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errBody = (err as any)?.response?.data?.error;
      if (errBody?.code === 'REPLY_WINDOW_ENDED') {
        setReplyWindow(errBody.replyWindow ?? { active: false, messagesRemaining: 0, messagesUsed: 5, firstReplyAt: null, expiresAt: null });
      }
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
    onSuccess: (res, _content, ctx) => {
      // Replace optimistic with real message
      queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
        queryKeys.thread(userId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === ctx?.optimistic.id ? res.message : m
            ),
          }));
          return { ...old, pages };
        }
      );
      // D1: post-increment window state drives the meter.
      if (res.replyWindow) setReplyWindow(res.replyWindow);
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

  // D2: voice note — append the server message to the cache on success.
  const sendVoice = useCallback(async (uri: string, durationMs: number) => {
    const msg = await sendVoiceMessage(userId, uri, durationMs);
    queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
      queryKeys.thread(userId),
      (old) => {
        if (!old) return { pages: [{ messages: [msg], nextCursor: null }], pageParams: [undefined] };
        const pages = [...old.pages];
        if (!pages[0].messages.some((m) => m.id === msg.id)) {
          pages[0] = { ...pages[0], messages: [msg, ...pages[0].messages] };
        }
        return { ...old, pages };
      }
    );
    queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
  }, [userId, queryClient]);

  // D2: reaction toggle — optimistic with server reconcile.
  const { mutate: doReact } = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => toggleReaction(id, emoji),
    onSuccess: (reactions, vars) => {
      queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
        queryKeys.thread(userId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => (m.id === vars.id ? { ...m, reactions } : m)),
          }));
          return { ...old, pages };
        }
      );
    },
    onError: () => showToast.error(t('error', 'Error'), t('chat.reactFailed', 'Could not react')),
  });

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    if (editingMsg) {
      doEdit({ id: editingMsg.id, content: text });
      setEditingMsg(null);
    } else {
      doSend(text);
      setReplyingTo(null);
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
    showToast.success(t('chat.reportSent', 'Report submitted. Thank you.'));
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
      <View style={{ flex: 1, backgroundColor: c.background }} testID="ChatThreadLoading">
        <ChatThreadSkeleton />
      </View>
    );
  }

  // Deep-link hole (C2): a free member can land here from a notification tap.
  // A 403 renders a real gate instead of an empty thread that errors on send.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((threadError as any)?.response?.status === 403) {
    return (
      <View style={[s.gateWrap, { paddingTop: insets.top }]} testID="ChatThreadGate">
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.gateBack} accessibilityLabel={t('back', 'Back')}>
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <View style={s.gateBody}>
          <View style={s.gateIcon}>
            <Ionicons name="lock-closed" size={32} color={c.secondary} />
          </View>
          <Text style={s.gateTitle}>{t('chat.gateTitle', 'Chat is a premium feature')}</Text>
          <Text style={s.gateLine}>
            {t('chat.gateLine', 'Upgrade to start the conversation with {{name}}.', { name: name || 'your match' })}
          </Text>
          <TouchableOpacity
            style={s.gateCta}
            onPress={() => navigation.navigate('Subscription')}
            testID="ChatGateUpgrade"
          >
            <Text style={s.gateCtaText}>{t('chat.gateCta', 'See plans')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const windowEnded = isGrantThread && replyWindow != null && !replyWindow.active;
  const endHeadline = replyWindow?.messagesRemaining === 0
    ? t('chat.windowExhausted', "You've used your 5 free replies")
    : t('chat.windowExpired', 'Your 48-hour reply window ended');

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          accessibilityLabel={t('back', 'Back')}
          testID="BackBtn"
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.headerProfile}
          onPress={() => navigation.navigate('ProfileDetail', { userId })}
          accessibilityLabel={`View ${name}'s profile`}
          testID="HeaderProfile"
        >
          <SmartImage uri={photo} name={name} style={s.headerAvatar} initialSize={16} />

          <Text style={s.headerName} numberOfLines={1}>{name}</Text>
        </TouchableOpacity>

        {/* Calls are config-gated on the Agora credentials, matching the web app
            (which hides its call UI when VITE_AGORA_APP_ID is unset). Without
            them these buttons navigate to a screen that cannot connect, so they
            are hidden rather than shown-and-broken. */}
        <View style={s.headerActions}>
          {CONFIG.IS_AGORA_CONFIGURED && (
          <>
          <PressableScale
            scaleTo={0.9}
            haptic
            style={s.headerBtn}
            onPress={() => navigation.navigate('VoiceCall', { calleeId: userId, channelName: `voice_${userId}` })}
            accessibilityLabel={t('chat.voiceCall', 'Voice call')}
            testID="VoiceCallBtn"
          >
            <Ionicons name="call-outline" size={22} color={c.textPrimary} />
          </PressableScale>
          <PressableScale
            scaleTo={0.9}
            haptic
            style={s.headerBtn}
            onPress={() => navigation.navigate('VideoCall', { calleeId: userId, channelName: `video_${userId}`, callType: 'video' })}
            accessibilityLabel={t('chat.videoCall', 'Video call')}
            testID="VideoCallBtn"
          >
            <Ionicons name="videocam-outline" size={22} color={c.textPrimary} />
          </PressableScale>
          </>
          )}
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
              color={c.primary}
              style={{ marginVertical: spacing.sm }}
            />
          ) : null
        }
        ListHeaderComponent={isOtherTyping ? <TypingIndicator /> : null}
      />

      {/* Edit banner */}
      {editingMsg && (
        <View style={s.editBanner} testID="EditBanner">
          <Ionicons name="pencil" size={14} color={c.primary} />
          <Text style={s.editBannerText} numberOfLines={1}>{editingMsg.content}</Text>
          <TouchableOpacity onPress={() => { setEditingMsg(null); setInput(''); }}>
            <Ionicons name="close" size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Reply-quote banner (D2, premium) */}
      {replyingTo && !editingMsg && (
        <View style={s.editBanner} testID="ReplyBanner">
          <Ionicons name="return-up-back" size={14} color={c.primary} />
          <Text style={s.editBannerText} numberOfLines={1}>
            {replyingTo.messageType === 'voice' ? 'Voice message' : replyingTo.content}
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)} accessibilityLabel="Cancel reply">
            <Ionicons name="close" size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {windowEnded ? (
        /* DS1: scripted paywalled composer — thread stays readable above. */
        <View style={[s.paywallBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]} testID="PaywalledComposer">
          <View style={{ flex: 1 }}>
            <Text style={s.paywallTitle}>{endHeadline}</Text>
            <Text style={s.paywallLine}>
              {t('chat.windowKeepTalking', '{{name}} can still write to you — upgrade to keep talking.', { name: (name || 'They').split(' ')[0] })}
            </Text>
          </View>
          <TouchableOpacity
            style={s.paywallCta}
            onPress={() => navigation.navigate('Subscription')}
            testID="PaywallUpgrade"
          >
            <Text style={s.paywallCtaText}>{t('chat.upgrade', 'Upgrade')}</Text>
          </TouchableOpacity>
        </View>
      ) : showRecorder ? (
        <View style={{ paddingBottom: Math.max(insets.bottom, spacing.xs) }}>
          <VoiceRecorderStrip onSend={sendVoice} onClose={() => setShowRecorder(false)} />
        </View>
      ) : (
      <View style={{ paddingBottom: Math.max(insets.bottom, spacing.xs) }}>
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={handleInputChange}
            placeholder={t('chat.typePlaceholder', 'Type a message…')}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={2000}
            accessibilityLabel={t('chat.typePlaceholder', 'Type a message')}
            testID="MessageInput"
          />
          {/* D2 voice note — premium only; grant threads are text-only (D1). */}
          {isPaid && !isGrantThread && !input.trim() && !editingMsg && (
            <PressableScale
              scaleTo={0.9}
              haptic
              style={s.micBtn}
              onPress={() => setShowRecorder(true)}
              accessibilityLabel={t('chat.recordVoice', 'Record a voice message')}
              testID="MicBtn"
            >
              <Ionicons name="mic-outline" size={20} color={c.textSecondary} />
            </PressableScale>
          )}
          <PressableScale
            scaleTo={0.9}
            haptic
            style={[s.sendBtn, (!input.trim() || isSending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isSending}
            accessibilityLabel={t('chat.send', 'Send')}
            testID="SendBtn"
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color={!input.trim() ? c.textMuted : '#fff'} />
            )}
          </PressableScale>
        </View>
        {/* DS3: the meter is last in the hierarchy — muted, warns at ≤2 */}
        {isGrantThread && replyWindow?.active && (
          <Text
            style={[s.meterText, replyWindow.messagesRemaining <= 2 && s.meterWarn]}
            accessibilityLiveRegion="polite"
            testID="ReplyMeter"
          >
            {t('chat.repliesLeft', '{{count}} free replies left', { count: replyWindow.messagesRemaining })}
          </Text>
        )}
      </View>
      )}

      {/* Long-press action menu */}
      <MessageActionMenu
        msg={selectedMsg}
        isOwn={isOwn}
        visible={selectedMsg !== null}
        canRich={isPaid}
        onClose={() => setSelectedMsg(null)}
        onEdit={(msg) => { setEditingMsg(msg); setInput(msg.content); }}
        onDelete={handleDeletePrompt}
        onReport={handleReport}
        onReact={(msg, emoji) => doReact({ id: msg.id, emoji })}
        onReply={setReplyingTo}
      />
    </KeyboardAvoidingView>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  // ── Phase C additions ──────────────────────────────────────────────────────
  quoteBlock: {
    borderLeftWidth: 2,
    paddingLeft: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
    borderRadius: 4,
  },
  quoteBlockOwn: { borderLeftColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.12)' },
  quoteBlockTheirs: { borderLeftColor: c.primary, backgroundColor: 'rgba(0,0,0,0.04)' },
  quoteText: { fontSize: typography.fontSize.xs, color: c.textMuted },
  reactionRow: { flexDirection: 'row', gap: 4, marginTop: 2, marginHorizontal: spacing.md },
  reactionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: c.surfaceCard, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2,
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: typography.fontSize.xs, color: c.textMuted, fontVariant: ['tabular-nums'] },
  emojiRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: spacing.xs,
  },
  emojiBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  micBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.xs,
  },
  meterText: {
    fontSize: typography.fontSize.xs, color: c.textMuted,
    paddingHorizontal: spacing.md, paddingTop: 4, fontVariant: ['tabular-nums'],
  },
  meterWarn: { color: c.secondary, fontWeight: '600' },
  paywallBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surfaceCard,
  },
  paywallTitle: { fontSize: typography.fontSize.sm, fontWeight: '600', color: c.textPrimary },
  paywallLine: { fontSize: typography.fontSize.xs, color: c.textMuted, marginTop: 2 },
  paywallCta: {
    backgroundColor: c.secondary, borderRadius: 22, paddingHorizontal: spacing.lg,
    minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  paywallCtaText: { color: '#fff', fontWeight: '700', fontSize: typography.fontSize.sm },
  gateWrap: { flex: 1, backgroundColor: c.background },
  gateBack: { padding: spacing.md, alignSelf: 'flex-start' },
  gateBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  gateIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: c.goldSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  gateTitle: {
    fontSize: typography.fontSize.xl, fontWeight: '700', color: c.textPrimary,
    textAlign: 'center', marginBottom: spacing.xs,
  },
  gateLine: { fontSize: typography.fontSize.sm, color: c.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  gateCta: {
    backgroundColor: c.primary, borderRadius: 24, paddingHorizontal: spacing.xl,
    minHeight: 48, alignItems: 'center', justifyContent: 'center',
  },
  gateCtaText: { color: '#fff', fontWeight: '700' },

  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: 10,
    backgroundColor: c.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
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
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    color: c.primary,
  },
  headerName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: c.textPrimary,
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
    backgroundColor: c.primaryLight + '30',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  contactBannerText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: c.primary,
  },
  contactPhone: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: c.success,
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
    backgroundColor: c.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: c.surfaceCard,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.textPrimary,
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
    color: c.textMuted,
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
    color: c.textMuted,
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
    backgroundColor: c.border,
  },
  dateLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: c.textMuted,
  },
  // Typing indicator
  typingRow: {
    alignItems: 'flex-start',
    marginVertical: spacing.xs,
  },
  typingBubble: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  typingDotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center', height: 18 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.textMuted },
  typingDotsLegacy: {
    fontSize: typography.fontSize.lg,
    color: c.textMuted,
    letterSpacing: 3,
  },
  // Edit banner
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: c.primaryLight + '20',
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  editBannerText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: c.primary,
    fontFamily: typography.fontFamily.medium,
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: c.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: c.border,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: c.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: c.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: c.n200,
  },
  // Action menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: c.surfaceCard,
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
    color: c.textPrimary,
  },
});
