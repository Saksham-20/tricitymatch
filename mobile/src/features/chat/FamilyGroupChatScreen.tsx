import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Screen from '../../components/layout/Screen';
import { PressableScale, useReduceMotion } from '../../components/motion';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ChatThreadSkeleton } from '../../components/ui/skeletons';
import { Button, EmptyState } from '../../components/ui';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import {
  getGroupThread,
  sendGroupMessage,
  inviteToFamilyGroup,
  leaveFamilyGroup,
  type GroupMessage,
} from '../../api/chat';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { showToast } from '../../utils/toast';
import { tapSize } from '../../utils/elderTheme';
import type { MainStackParamList } from '../../navigation/types';
import { CHAT_LIST_PERF } from '../../constants/listPerf';

type Nav = NativeStackNavigationProp<MainStackParamList, 'FamilyGroupChat'>;
type Route = RouteProp<MainStackParamList, 'FamilyGroupChat'>;

// ─── Thread cache helpers ─────────────────────────────────────────────────────
// The optimistic row, the REST response and the socket broadcast can all carry
// the same message. Every write goes through these so it lands exactly once.

type GroupCache = { pages: { messages: GroupMessage[]; nextCursor: string | null }[]; pageParams: unknown[] };

const hasMessage = (cache: GroupCache, id: string) =>
  cache.pages.some((p) => p.messages.some((m) => m.id === id));

/** Prepend to the newest page unless a message with that id is already cached. */
const withMessage = (old: GroupCache | undefined, msg: GroupMessage): GroupCache | undefined => {
  if (!old || old.pages.length === 0 || hasMessage(old, msg.id)) return old;
  const pages = [...old.pages];
  pages[0] = { ...pages[0], messages: [msg, ...pages[0].messages] };
  return { ...old, pages };
};

const withoutMessage = (old: GroupCache | undefined, id: string): GroupCache | undefined =>
  old && { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.filter((m) => m.id !== id) })) };

/** Apply a server-authoritative edit (`group-message-edited`) to the cached message. */
const withEdit = (old: GroupCache | undefined, id: string, content: string, editedAt: string | null): GroupCache | undefined =>
  old && { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m.id === id ? { ...m, content, editedAt } : m)) })) };

/** Swap the optimistic row for the server's; if the socket already delivered it, just drop the optimistic one. */
const settleMessage = (old: GroupCache | undefined, optimisticId: string | undefined, real: GroupMessage): GroupCache | undefined => {
  if (!old || !optimisticId) return old;
  if (hasMessage(old, real.id)) return withoutMessage(old, optimisticId);
  return { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m.id === optimisticId ? real : m)) })) };
};

/**
 * True while the software keyboard is up. The composer owes the bottom safe
 * inset only while it is down; with it up the keyboard already covers that strip.
 */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => setUp(true));
    const b = Keyboard.addListener(hideEvt, () => setUp(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return up;
}

/**
 * `useSocket()` plus a re-read of the singleton it exposes.
 *
 * `useSocket` returns `socket: socketInstance`, a module variable read at render
 * time; nothing re-renders a consumer when that instance is replaced. Two moments
 * replace it: the hook's own connect effect (which runs after the first render
 * that already read `null`) and a foreground resume, which builds a brand-new
 * `io()`. A screen binding listeners to `socket` would keep them on a dead
 * instance until something unrelated re-rendered it, so: re-render once after
 * mount and again after every resume, deferred a macrotask so every mounted
 * `useSocket`'s own AppState handler has finished swapping the instance. The
 * proper fix is the hook holding the instance in state; see primitiveRequests.
 */
function useLiveSocket() {
  const api = useSocket();
  const [, setTick] = useState(0);
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => setTick((n) => n + 1), 0);
    };
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      sub.remove();
      if (pending) clearTimeout(pending);
    };
  }, []);
  return api;
}

// ─── Date separator ───────────────────────────────────────────────────────────

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// Dates and times follow the device locale (`[]`), the same as the one-to-one
// thread. They were pinned to 'en-IN', so a Hindi or Punjabi member read English
// month names in this chat and their own script everywhere else. Today and
// Yesterday come from the same i18n keys the thread uses.
function formatDateLabel(iso: string, t: TFunction) {
  const d = new Date(iso);
  const today = new Date();
  if (isSameDay(iso, today.toISOString())) return t('chat.today', 'Today');
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (isSameDay(iso, yest.toISOString())) return t('chat.yesterday', 'Yesterday');
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  msg: GroupMessage;
  isOwn: boolean;
  showSender: boolean;
}

// Memoised: the composer re-renders the screen on every keystroke. No `entering`
// animation: this is a virtualized row and would replay as it scrolls back in.
const GroupMessageBubble = React.memo(function GroupMessageBubble({ msg, isOwn, showSender }: BubbleProps) {
  const { c } = useTheme();
  const bub = getBub(c);
  const time = formatTime(msg.createdAt);
  // One spoken line per message: who, what, when. Otherwise sender, body, "edited"
  // and time are four separate stops for a screen reader.
  const label = [
    `${isOwn ? 'You' : msg.senderName}: ${msg.content}`,
    msg.editedAt ? 'edited' : '',
    time,
  ].filter(Boolean).join('. ');
  return (
    <View style={[bub.row, isOwn && bub.rowOwn]}>
      <View style={[bub.bubble, isOwn ? bub.ownBubble : bub.theirBubble]} accessible accessibilityLabel={label}>
        {!isOwn && showSender && (
          <Text variant="caption" color="primary" style={bub.senderName}>{msg.senderName}</Text>
        )}
        <Text variant="callout" color={isOwn ? 'onPrimary' : 'textPrimary'}>{msg.content}</Text>
        <View style={bub.meta}>
          {msg.editedAt && <Text variant="micro" color={isOwn ? 'onPrimary' : 'textMuted'} style={isOwn && bub.ownMeta}>edited · </Text>}
          <Text variant="micro" color={isOwn ? 'onPrimary' : 'textMuted'} style={isOwn && bub.ownMeta}>{time}</Text>
        </View>
      </View>
    </View>
  );
});

// Built once per palette, not once per bubble: rows remount as they scroll back
// into the window. `c` is always the `colours` / `darkColours` singleton.
const bubByPalette = new WeakMap<ThemeColours, ReturnType<typeof makeBub>>();
function getBub(c: ThemeColours): ReturnType<typeof makeBub> {
  let sheet = bubByPalette.get(c);
  if (!sheet) {
    sheet = makeBub(c);
    bubByPalette.set(c, sheet);
  }
  return sheet;
}

const makeBub = (c: ThemeColours) => StyleSheet.create({
  row:        { flexDirection: 'row', marginVertical: 2, paddingHorizontal: spacing.md },
  rowOwn:     { justifyContent: 'flex-end' },
  bubble:     { maxWidth: '75%', borderRadius: borderRadius.lg, padding: spacing.sm, paddingHorizontal: spacing.md },
  // p500 is #8B2346 in both palettes; c.primary is the lighter #C75D7E accent in
  // dark mode, which is under AA against the white text (~3.96:1).
  ownBubble:  { backgroundColor: c.p500, borderBottomRightRadius: 4 },
  theirBubble:{ backgroundColor: c.surfaceCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
  senderName: { marginBottom: 2 },
  meta:       { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  ownMeta:    { opacity: 0.7 },
});

// ─── Add-member modal ─────────────────────────────────────────────────────────
// The backend's `/invite` route is `addMember`: it adds an existing TricityMatch
// user straight to the group by phone. It sends no SMS and there is no accept
// step, so the old "Send Invite via SMS" / "They will join via SMS link" copy
// described something that does not happen.

interface InviteModalProps {
  visible: boolean;
  groupId: string;
  onClose: () => void;
  /** Fires once the server has added the person, so the caller can refresh its counts. */
  onAdded: () => void;
}

/**
 * The 10-digit mobile behind whatever was typed or pasted ("+91 98765 43210",
 * "098765-43210", "9876543210"), or null. Same rule as the signup field, and the
 * form the server matches on: `addMember` looks the number up exactly as sent,
 * and accounts store a bare 10-digit mobile, so "+91..." would never find them.
 */
function toTenDigitMobile(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** HTTP status and the server's own message from a failed request, if it got that far. */
function failureOf(e: unknown): { status?: number; message?: string } {
  const res = (e as { response?: { status?: number; data?: { error?: { message?: string } } } })?.response;
  return { status: res?.status, message: res?.data?.error?.message };
}

function InviteModal({ visible, groupId, onClose, onAdded }: InviteModalProps) {
  const { c } = useTheme();
  const im = React.useMemo(() => makeIm(c), [c]);
  const reduced = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // An inline error is plain text: unlike the Alert it replaced, nothing speaks
  // it, and focus stays on the button that was just pressed. Say it.
  const fail = (message: string) => {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  // Both failure paths stay in the sheet, under the field, with the number
  // intact. They were Alert popups, and an Alert cannot be seen through the
  // open sheet's keyboard on Android anyway.
  const handleInvite = async () => {
    const number = toTenDigitMobile(phone);
    if (!number) {
      fail('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      // The API still takes a relation, but the server ignores it (membership is
      // tracked by role), so the sheet no longer asks for one it would throw away.
      await inviteToFamilyGroup(groupId, number, 'member');
      setPhone('');
      onAdded();
      onClose();
      showToast.success('Family member added', `${number} is now in this group.`);
    } catch (e) {
      // Blame the right thing. Only a plain miss is about the number: the server
      // answers "not the owner" with 403, "full" and a miss with 400 (a miss is
      // deliberately indistinguishable from a hit, so it is the generic case).
      const { status, message } = failureOf(e);
      if (status === 409) fail('That person is already in this group.');
      else if (status === 403) fail('Only the group owner can add members.');
      else if (status === 400 && message && /full/i.test(message)) fail(message);
      else if (status === 429) fail('Too many tries. Wait a little and try again.');
      else if (status === undefined) fail("Couldn't reach the server. Check your connection and try again.");
      else fail("Couldn't add that number. Check it, and make sure they have a TricityMatch account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Reduce Motion: a fade, never a slide (doctrine §10.2 ruling 18).
    <Modal visible={visible} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={onClose}>
      {/* The phone pad would otherwise cover the Add button. */}
      <KeyboardAvoidingView style={im.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Tap outside to dismiss. Cancel is the reader's way out, so the backdrop
            stays out of the accessibility tree rather than being a second one. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => { if (!loading) onClose(); }}
          accessible={false}
          importantForAccessibility="no"
          testID="invite-backdrop"
        />
        {/* No drag handle: the sheet does not drag. The bottom padding clears the
            home indicator / 3-button bar (it was a flat 32). */}
        <View style={[im.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) + spacing.lg }]}>
          <Text variant="title3" color="textPrimary" style={im.title} accessibilityRole="header">Add family member</Text>

          <Input
            label="Phone number"
            value={phone}
            onChangeText={(v) => { setPhone(v); if (error) setError(undefined); }}
            placeholder="98765 43210"
            keyboardType="phone-pad"
            // Room for a pasted "+91 98765 43210" (15) with its separators; the
            // number is normalised on submit, so nothing may be cut off here.
            maxLength={18}
            helper="They need a TricityMatch account with this number."
            error={error}
            testID="invite-phone-input"
            accessibilityLabel="Phone number to add"
          />

          <Button
            title="Add to group"
            onPress={handleInvite}
            loading={loading}
            style={im.sendBtn}
            testID="send-invite-btn"
          />
          <Button
            title="Cancel"
            variant="text"
            onPress={onClose}
            disabled={loading}
            testID="cancel-invite-btn"
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeIm = (c: ThemeColours) => StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
  // paddingBottom is applied inline (it depends on the bottom safe-area inset).
  sheet:         { backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl },
  title:         { marginBottom: spacing.lg },
  sendBtn:       { marginBottom: spacing.sm },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilyGroupChatScreen() {
  const { c, elder } = useTheme();
  const { t } = useTranslation();
  const sep = React.useMemo(() => makeSep(c), [c]);
  const s = React.useMemo(() => makeS(c), [c]);
  const tap = tapSize(elder);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupId, groupName, memberCount } = route.params;

  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { socket } = useLiveSocket();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();

  const [text, setText] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const listRef = useRef<FlatList<GroupMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch, error: loadError } = useInfiniteQuery({
    queryKey: queryKeys.groupThread(groupId),
    queryFn: ({ pageParam }) => getGroupThread(groupId, pageParam as string | undefined),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30 * 1000,
    // 403/404 mean this member was removed or the group is gone: a real state,
    // not a flake, so do not spend three backoff retries on the skeleton first.
    retry: (count, err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.response?.status;
      if (status === 403 || status === 404) return false;
      return count < 2;
    },
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendGroupMessage(groupId, content),
    onMutate: async (content) => {
      const optimistic: GroupMessage = {
        id: `opt-${Date.now()}`,
        groupId,
        senderId: user!.id,
        senderName: user!.email,
        content,
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      queryClient.setQueryData<GroupCache>(queryKeys.groupThread(groupId), (old) => withMessage(old, optimistic));
      return { optimisticId: optimistic.id };
    },
    // Neither of these existed: the optimistic row was never reconciled, so a
    // sent message showed twice once the socket echoed it, and a failed one
    // stayed on screen as if delivered while only an alert said otherwise.
    onSuccess: (message, _content, ctx) => {
      queryClient.setQueryData<GroupCache>(queryKeys.groupThread(groupId), (old) => settleMessage(old, ctx?.optimisticId, message));
    },
    onError: (_err, content, ctx) => {
      if (ctx) queryClient.setQueryData<GroupCache>(queryKeys.groupThread(groupId), (old) => withoutMessage(old, ctx.optimisticId));
      showToast.error('Message not sent', 'Your message is back in the box. Try again.');
      setText((cur) => cur || content);
    },
  });

  // Realtime for this group, bound straight onto the live socket. Room membership
  // lives on the server-side socket, so a reconnect drops it: re-join on every
  // 'connect' (an already-connected socket will not fire one, so join now too) or
  // an idle reader silently stops receiving anything.
  useEffect(() => {
    if (!socket) return undefined;
    const key = queryKeys.groupThread(groupId);

    const onReceived = (msg: GroupMessage) => {
      if (msg.groupId !== groupId) return;
      queryClient.setQueryData<GroupCache>(key, (old) => withMessage(old, msg));
      // A message from someone else appears without a tap: tell a screen reader.
      if (msg.senderId !== user?.id) {
        AccessibilityInfo.announceForAccessibility(`${msg.senderName}: ${msg.content}`);
      }
    };
    // Edits and deletes are server-authoritative broadcasts too; without these a
    // deleted message stayed on every other member's screen.
    const onEdited = (p: { groupId: string; messageId: string; content: string; editedAt: string | null }) => {
      if (p?.groupId !== groupId || !p.messageId) return;
      queryClient.setQueryData<GroupCache>(key, (old) => withEdit(old, p.messageId, p.content, p.editedAt ?? new Date().toISOString()));
    };
    const onDeleted = (p: { groupId: string; messageId: string }) => {
      if (p?.groupId !== groupId || !p.messageId) return;
      queryClient.setQueryData<GroupCache>(key, (old) => withoutMessage(old, p.messageId));
    };

    const join = () => socket.emit('join-group', { groupId });
    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('group-message-received', onReceived);
    socket.on('group-message-edited', onEdited);
    socket.on('group-message-deleted', onDeleted);
    return () => {
      socket.off('connect', join);
      socket.off('group-message-received', onReceived);
      socket.off('group-message-edited', onEdited);
      socket.off('group-message-deleted', onDeleted);
      socket.emit('leave-group', groupId);
    };
  }, [socket, groupId, queryClient, user?.id]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    sendMutation.mutate(trimmed);
  }, [text, sendMutation]);

  // Ruling 22: this Alert stays, it confirms a destructive action. Its failure
  // path is a toast, not a second alert.
  const handleLeave = () => {
    Alert.alert('Leave group', 'Leave this family group chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveFamilyGroup(groupId);
            queryClient.invalidateQueries({ queryKey: queryKeys.familyGroups });
            navigation.goBack();
          } catch (e) {
            // Blame the right thing. Connection copy on every failure told the
            // group's owner to retry something the server will keep refusing: the
            // owner cannot leave while other members remain (400). The app has no
            // delete-group or hand-over screen, so do not send them to one.
            const { status } = failureOf(e);
            if (status === 400) {
              showToast.error("Couldn't leave the group", "You own this group, so you can't leave while other members are in it.");
            } else if (status === 403 || status === 404) {
              showToast.error("You're not in this group", 'You may already have been removed.');
            } else {
              showToast.error("Couldn't leave the group", 'Check your connection and try again.');
            }
          }
        },
      },
    ]);
  };

  // The header count is a route param and the list row reads a cached query, so a
  // successful add has to move both or they keep quoting the old number.
  const handleMemberAdded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.familyGroups });
    navigation.setParams({ memberCount: memberCount + 1 });
  }, [queryClient, navigation, memberCount]);

  const messages = useMemo(() => data?.pages.flatMap((p) => p.messages) ?? [], [data]);

  const renderItem = useCallback(({ item, index }: { item: GroupMessage; index: number }) => {
    const isOwn = item.senderId === user?.id;
    const prev = messages[index + 1];
    const showDate = !prev || !isSameDay(item.createdAt, prev.createdAt);
    const showSender = !isOwn && (!prev || prev.senderId !== item.senderId || !isSameDay(item.createdAt, prev.createdAt));

    return (
      <>
        <GroupMessageBubble msg={item} isOwn={isOwn} showSender={showSender} />
        {/* Inverted list: a cell draws its children bottom-up, so the day label goes
            AFTER the bubble to sit above its day's first message. */}
        {showDate && (
          <View style={sep.container}>
            <Text variant="caption" color="textMuted" style={sep.label}>{formatDateLabel(item.createdAt, t)}</Text>
          </View>
        )}
      </>
    );
  }, [messages, user?.id, sep, t]);

  const loadFailed = isError && !data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadStatus = (loadError as any)?.response?.status;
  const notAMember = loadStatus === 403 || loadStatus === 404;
  // No composer until a thread exists to write into (an optimistic send while
  // loading lands in a cache that is not there yet and never appears), and none
  // once the server says this member is out of the group.
  const canCompose = !isLoading && !loadFailed && !notAMember;
  const canSend = !!text.trim();
  const composerBottom = keyboardUp ? spacing.sm : Math.max(insets.bottom, spacing.sm);
  const members = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;

  return (
    // The stack sets headerShown:false, so the KAV starts at the top of the
    // screen and needs no offset (it was 90, a native-header height, which
    // pushed the composer 90pt clear of the keyboard on iOS). Screen supplies the
    // top inset: this header used to draw under the status bar and notch.
    <KeyboardAvoidingView
      style={s.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      testID="FamilyGroupChatScreen"
    >
      <Screen edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={[s.iconBtn, { width: tap, height: tap }]}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="back-btn"
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <View style={s.headerInfo}>
          <View style={s.groupAvatarCircle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="people" size={18} color={c.onPrimary} />
          </View>
          <View style={s.headerText}>
            <Text variant="headline" color="textPrimary" numberOfLines={1} accessibilityRole="header">{groupName}</Text>
            <Text variant="caption" color="textSecondary">{members}</Text>
          </View>
        </View>
        {/* Both of these can only 403 for a member who is no longer in the group. */}
        {!notAMember && (
        <View style={s.headerActions}>
          <PressableScale
            style={[s.iconBtn, { width: tap, height: tap }]}
            onPress={() => setShowInvite(true)}
            accessibilityLabel="Add family member"
            accessibilityRole="button"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="invite-btn"
          >
            <Ionicons name="person-add-outline" size={22} color={c.primary} />
          </PressableScale>
          <PressableScale
            style={[s.iconBtn, { width: tap, height: tap }]}
            onPress={handleLeave}
            accessibilityLabel="Leave group"
            accessibilityRole="button"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="leave-btn"
          >
            <Ionicons name="exit-outline" size={22} color={c.error} />
          </PressableScale>
        </View>
        )}
      </View>

      {/* Family group notice: one neutral info strip (no tinted wash). */}
      <View style={s.noticeBanner}>
        <Ionicons name="information-circle-outline" size={14} color={c.textMuted} style={{ marginRight: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Text variant="caption" color="textSecondary" style={s.noticeText}>Family group · Only members of this group can see this chat</Text>
      </View>

      {/* Messages */}
      {isLoading ? (
        <ChatThreadSkeleton />
      ) : loadFailed ? (
        <View style={s.loadingState}>
          {notAMember ? (
            <EmptyState
              variant="error"
              icon="people-outline"
              title="You're not in this group"
              description="You may have been removed, or the group no longer exists."
              actionLabel="Go back"
              onAction={() => navigation.goBack()}
              testID="FamilyGroupChatScreen-removed"
            />
          ) : (
            <EmptyState
              variant="error"
              icon="chatbubbles-outline"
              title="Couldn't load messages"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
              testID="FamilyGroupChatScreen-error"
            />
          )}
        </View>
      ) : (
        <FlatList
          {...CHAT_LIST_PERF}
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[s.listContent, messages.length === 0 && s.listContentEmpty]}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator size="small" color={c.primary} style={{ marginVertical: spacing.md }} accessibilityLabel="Loading earlier messages" /> : null}
          ListEmptyComponent={
            // RN un-flips the empty element of an inverted list itself; the shared
            // EmptyState replaces a hand-rolled block that carried its own scaleY.
            <View style={s.emptyBody}>
              <EmptyState
                icon="chatbubbles-outline"
                title="Start the conversation"
                description="Share updates and talk through matches with your family."
                actionLabel="Write a message"
                onAction={() => inputRef.current?.focus()}
                testID="FamilyGroupChatScreen-empty"
              />
            </View>
          }
        />
      )}

      {/* Input bar: only once the thread has loaded, matching ChatThread. */}
      {canCompose && (
        <View style={[s.inputBar, { paddingBottom: composerBottom }]}>
          <Input
            containerStyle={s.inputContainer}
            style={s.input}
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Message your family…"
            multiline
            maxLength={2000}
            testID="message-input"
            accessibilityLabel="Message input"
          />
          <PressableScale
            scaleTo={0.9}
            haptic
            style={[s.sendBtn, { width: tap, height: tap, borderRadius: tap / 2 }, !canSend && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
            accessibilityLabel="Send message"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="send-btn"
          >
            <Ionicons name="send" size={20} color={canSend ? c.onPrimary : c.textMuted} />
          </PressableScale>
        </View>
      )}

      <InviteModal visible={showInvite} groupId={groupId} onClose={() => setShowInvite(false)} onAdded={handleMemberAdded} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const makeSep = (c: ThemeColours) => StyleSheet.create({
  container: { alignItems: 'center', marginVertical: spacing.md },
  label:     { backgroundColor: c.surfaceCard, paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: borderRadius.full },
});

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:          { flex: 1, backgroundColor: c.background },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  // Size (48 / 60 elder) is applied inline from tapSize().
  iconBtn:          { alignItems: 'center', justifyContent: 'center' },
  headerInfo:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.xs },
  headerText:       { flex: 1 },
  groupAvatarCircle:{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.p500, alignItems: 'center', justifyContent: 'center' },
  headerActions:    { flexDirection: 'row' },
  noticeBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface2, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  noticeText:       { flex: 1 },
  loadingState:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent:      { paddingVertical: spacing.md },
  listContentEmpty: { flexGrow: 1 },
  emptyBody:        { flex: 1, justifyContent: 'center' },
  inputBar:         { flexDirection: 'row', alignItems: 'flex-end', paddingTop: spacing.sm, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background, gap: spacing.sm },
  inputContainer:   { flex: 1, marginBottom: 0 },
  input:            { minHeight: 44, maxHeight: 120 },
  // Target size (48 / 60 elder) and radius come inline from tapSize().
  sendBtn:          { backgroundColor: c.p500, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:  { backgroundColor: c.surface2 },
});
