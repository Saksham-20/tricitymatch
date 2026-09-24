import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Pressable, TextInput,
  AccessibilityInfo, Keyboard, AppState,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import SmartImage from '../../components/common/SmartImage';
import Screen from '../../components/layout/Screen';
import { PressableScale, useReduceMotion } from '../../components/motion';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { EASE_IN_OUT, STAGGER_MS, duration } from '@shared/constants/motion';

// The typing-dot loop is one of doctrine §10.3's four sanctioned infinite loops.
// Its cadence is built from the duration table rather than typed in: a bounce is
// one `content` step each way, and the rest between bounces is two of them, which
// keeps the whole cycle near the handoff's 1.2s. (A dedicated `loop` token in
// motion.ts would say this directly; see primitiveRequests.)
const TYPING_DOT_BOUNCE_MS = duration.content;
const TYPING_DOT_REST_MS = duration.content * 2;
import { ChatThreadSkeleton } from '../../components/ui/skeletons';
import { Button, EmptyState, SkeletonBlock } from '../../components/ui';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '../../utils/toast';
import { haptics } from '../../utils/haptics';
import { tapSize } from '../../utils/elderTheme';
import { spacing, borderRadius, shadows, darkShadows, type ThemeColours } from '@shared/constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { unlockContact } from '../../api/matches';
import { getThread, sendMessage, editMessage, deleteMessage, sendVoiceMessage, toggleReaction } from '../../api/chat';
import { VoiceRecorderStrip, VoiceMessageBubble } from './VoiceMessage';
import BlockReportSheet from '../profile/BlockReportSheet';
import { REACTION_EMOJIS, FREE_REPLY_MAX_MESSAGES, FREE_REPLY_WINDOW_MS } from '@shared/constants/chat';
import type { ReplyWindow } from '@shared/types/chat';
import { getProfile } from '../../api/profile';
import { CONFIG } from '../../constants/config';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { Message } from '../../types';
import { CHAT_LIST_PERF } from '../../constants/listPerf';

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

/**
 * Whole calendar days between `iso` and today (0 = today, 1 = yesterday). Elapsed
 * hours are not days: a message at 11pm last night is "Yesterday" at 8am, and it
 * must not read "Today" just because fewer than 24 hours have passed. Rounds to
 * absorb the 23/25-hour days either side of a DST change.
 */
function calendarDaysAgo(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  const startOfMsgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((startOfToday - startOfMsgDay) / 86400000);
}

/** "1 free reply left" / "2 free replies left" (the meter and its announcement). */
function repliesLeftText(t: TFunction, count: number): string {
  return t('chat.repliesLeft', {
    count,
    defaultValue: '{{count}} free reply left',
    defaultValue_plural: '{{count}} free replies left',
  });
}

function canEdit(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 15 * 60 * 1000;
}

/**
 * True while the software keyboard is up. The composer owes the bottom safe
 * inset only when the keyboard is down: with it up the keyboard already covers
 * the home-indicator strip, so keeping the inset leaves a dead band above it.
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
 * time, and nothing re-renders a consumer when that instance is replaced. Two
 * moments replace it: the hook's own connect effect, which runs AFTER the first
 * render that already read `null`, and a foreground resume, which builds a new
 * `io()` (the old one is disconnected and gone). Without a nudge a screen that
 * binds listeners to `socket` keeps them on a dead instance until something
 * unrelated re-renders it. So: re-render once after mount (the connect effect
 * has run by then) and again after every resume, deferred a macrotask so every
 * mounted `useSocket`'s own AppState handler has finished swapping the instance.
 * The proper fix is the hook holding the instance in state; see primitiveRequests.
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

// ─── Typing indicator — 3 dots bouncing on a 1.2s loop (handoff spec) ───────
function TypingDot({ delay }: { delay: number }) {
  const { c } = useTheme();
  const s = getS(c);
  const reduced = useReduceMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    // Reduce Motion flipping on mid-loop must leave the dot at rest, not frozen
    // wherever the bounce happened to be. The three dots still read as "typing",
    // and the row's own label says it aloud.
    cancelAnimation(y);
    y.value = 0;
    if (reduced) return undefined;
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: TYPING_DOT_BOUNCE_MS, easing: Easing.bezier(...EASE_IN_OUT) }),
          withTiming(0, { duration: TYPING_DOT_BOUNCE_MS, easing: Easing.bezier(...EASE_IN_OUT) }),
          withTiming(0, { duration: TYPING_DOT_REST_MS, easing: Easing.bezier(...EASE_IN_OUT) }),
        ),
        -1,
      ),
    );
    return () => {
      cancelAnimation(y);
      y.value = 0;
    };
  }, [reduced, delay, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[s.typingDot, st]} />;
}

function TypingIndicator({ name }: { name: string }) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const s = getS(c);
  return (
    <View
      style={s.typingRow}
      testID="TypingIndicator"
      accessible
      accessibilityLabel={t('chat.typingA11y', '{{name}} is typing', { name })}
      accessibilityLiveRegion="polite"
    >
      {/* the dots are decoration; the label above carries the meaning */}
      <View
        style={s.typingBubble}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={s.typingDotsRow}>
          <TypingDot delay={0} />
          <TypingDot delay={STAGGER_MS * 3} />
          <TypingDot delay={STAGGER_MS * 6} />
        </View>
      </View>
    </View>
  );
}

// ─── Read receipt ────────────────────────────────────────────────────────────
// Decorative: the delivery state is spoken in the bubble's accessibilityLabel.
function ReadReceipt({ msg }: { msg: Message }) {
  const { c } = useTheme();
  const read = !!msg.readAt;
  const delivered = !!msg.deliveredAt;
  return (
    <Ionicons
      name={read || delivered ? 'checkmark-done' : 'checkmark'}
      size={15}
      color={c.onPrimary}
      style={read ? undefined : { opacity: 0.65 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────────
interface BubbleProps {
  msg: Message;
  isOwn: boolean;
  /** Who the other person is, for the spoken label. */
  senderName: string;
  /** Opens the actions menu. Long press is the shortcut, a plain tap the fallback. */
  onOpenActions: (msg: Message) => void;
}

// Memoised: the composer re-renders the screen on every keystroke and a
// thread can hold hundreds of rows. There is deliberately NO `entering`
// animation here — a virtualized row remounts as it scrolls back into the
// window (and swaps key when its optimistic id is replaced by the server's),
// so an entrance would replay on history (doctrine §10.8 Lists).
const MessageBubble = React.memo(function MessageBubble({ msg, isOwn, senderName, onOpenActions }: BubbleProps) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const s = getS(c);
  // Optimistic sends render at half opacity until the server ack swaps in
  // the real message (id no longer tmp-*). They have no server id yet, so
  // edit/delete/react on them would 404: the menu stays closed.
  const pending = msg.id.startsWith('tmp-');
  const isVoice = msg.messageType === 'voice';
  const reactions = Object.entries(msg.reactions || {}).filter(([, u]) => u?.length);

  const open = useCallback(() => { if (!pending) onOpenActions(msg); }, [pending, onOpenActions, msg]);
  const openFromLongPress = useCallback(() => {
    if (pending) return;
    haptics.medium();
    onOpenActions(msg);
  }, [pending, onOpenActions, msg]);

  const who = isOwn ? t('chat.a11yYou', 'You') : senderName;
  const status = !isOwn
    ? ''
    : pending
      ? t('chat.a11ySending', 'Sending')
      : msg.readAt
        ? t('chat.a11yRead', 'Read')
        : msg.deliveredAt
          ? t('chat.a11yDelivered', 'Delivered')
          : t('chat.a11ySent', 'Sent');
  const time = formatMsgTime(msg.createdAt);
  const quote = msg.ReplyTo
    ? t('chat.a11yInReplyTo', 'In reply to {{text}}', {
        text: msg.ReplyTo.messageType === 'voice' ? t('chat.voiceMessage', 'Voice message') : msg.ReplyTo.content,
      })
    : '';
  const label = [
    `${who}: ${isVoice ? t('chat.voiceMessage', 'Voice message') : msg.content}`,
    quote,
    msg.isEdited ? t('chat.edited', 'edited') : '',
    time,
    status,
    reactions.length ? reactions.map(([e, u]) => `${e} ${u.length}`).join(', ') : '',
  ].filter(Boolean).join('. ');

  return (
    <View style={[s.bubbleRow, isOwn ? s.bubbleRowOwn : s.bubbleRowTheirs]}>
      <PressableScale
        onPress={open}
        onLongPress={openFromLongPress}
        delayLongPress={400}
        style={s.bubbleWrap}
        testID={`Bubble-${msg.id}`}
        // A voice bubble carries its own play control. An accessible parent
        // would swallow it on iOS (VoiceOver treats the parent as one element),
        // so for voice the group is opened up and the play button offers the
        // "message actions" action instead.
        accessible={!isVoice}
        accessibilityLabel={label}
        // A still-sending row cannot open the menu (no server id yet), so it must
        // not promise one.
        accessibilityHint={pending ? undefined : t('chat.a11yOpenActions', 'Opens message actions')}
        accessibilityRole="button"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {/* The "sending" dim lives here, not on the PressableScale: its animated
            style owns `opacity` and would override a static one. */}
        <View style={pending ? s.pendingRow : undefined}>
          <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleTheirs]}>
            {msg.ReplyTo && (
              <View style={[s.quoteBlock, isOwn ? s.quoteBlockOwn : s.quoteBlockTheirs]}>
                <Text
                  variant="footnote"
                  color={isOwn ? 'onPrimary' : 'textMuted'}
                  style={isOwn ? { opacity: 0.85 } : undefined}
                  numberOfLines={2}
                >
                  {msg.ReplyTo.messageType === 'voice' ? t('chat.voiceMessage', 'Voice message') : msg.ReplyTo.content}
                </Text>
              </View>
            )}
            {isVoice ? (
              <VoiceMessageBubble
                uri={msg.mediaUrl}
                durationMs={msg.mediaDurationMs}
                own={isOwn}
                from={isOwn ? 'you' : senderName}
                onMoreActions={open}
              />
            ) : (
              // The product's main reading text: `callout` (16), not `footnote`
              // (13). Same role as the family-group bubble.
              <Text variant="callout" color={isOwn ? 'onPrimary' : 'textPrimary'}>
                {msg.content}
              </Text>
            )}
            {msg.isEdited && (
              <Text variant="micro" color={isOwn ? 'onPrimary' : 'textMuted'} style={[s.editedTag, isOwn && { opacity: 0.65 }]}>
                {t('chat.edited', 'edited')}
              </Text>
            )}
            <View
              style={s.bubbleMeta}
              accessible={isVoice}
              accessibilityLabel={isVoice ? [time, status].filter(Boolean).join('. ') : undefined}
            >
              <Text variant="micro" color={isOwn ? 'onPrimary' : 'textMuted'} style={isOwn ? { opacity: 0.7 } : undefined}>
                {time}
              </Text>
              {isOwn && <ReadReceipt msg={msg} />}
            </View>
          </View>
          {reactions.length > 0 && (
            <View style={[s.reactionRow, isOwn && { alignSelf: 'flex-end' }]}>
              {reactions.map(([emoji, users]) => (
                <View key={emoji} style={s.reactionPill}>
                  <Text variant="footnote">{emoji}</Text>
                  {users.length > 1 && <Text variant="caption" color="textMuted" style={s.reactionCount}>{users.length}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>
      </PressableScale>
    </View>
  );
});

// ─── Date separator ──────────────────────────────────────────────────────────
function DateSeparator({ iso }: { iso: string }) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const s = getS(c);
  const d = new Date(iso);
  const diffDays = calendarDaysAgo(iso);
  const label =
    diffDays === 0
      ? t('chat.today', 'Today')
      : diffDays === 1
        ? t('chat.yesterday', 'Yesterday')
        : d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <View style={s.dateSep}>
      <View style={s.dateLine} />
      <Text variant="caption" color="textMuted">{label}</Text>
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
  const { c, elder } = useTheme();
  const s = getS(c);
  const { t } = useTranslation();
  const [phone, setPhone] = useState<string | null>(null);

  const { mutate: unlock, isPending } = useMutation({
    mutationFn: () => unlockContact(userId),
    onSuccess: (res) => {
      setPhone(res.phone);
      onUnlocked(res.phone);
      // Appears without a tap on the screen reader's focus: announce it
      // (accessibilityLiveRegion is Android-only, this covers both).
      AccessibilityInfo.announceForAccessibility(t('chat.contactUnlockedA11y', 'Phone number unlocked: {{phone}}', { phone: res.phone }));
    },
    onError: (err) => {
      // Say what actually happened. This used to blame "your quota" for every
      // failure, including a dropped connection and the daily cap that unlimited
      // plans carry. The server's own message names the real number, so it is
      // shown as sent; the codes are the ones checkContactUnlockLimit throws.
      const res = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response;
      const code = res?.data?.error?.code;
      const serverMessage = res?.data?.error?.message;
      if (code === 'CONTACT_UNLOCK_LIMIT_REACHED') {
        showToast.error(t('chat.unlockQuotaTitle', 'No unlocks left'), serverMessage ?? t('chat.unlockQuotaBody', 'You have used every contact unlock on your plan.'));
      } else if (code === 'DAILY_UNLOCK_LIMIT_REACHED') {
        showToast.error(t('chat.unlockDailyTitle', 'Daily limit reached'), serverMessage ?? t('chat.unlockDailyBody', 'Try again after 24 hours.'));
      } else if (!res) {
        showToast.error(t('chat.unlockFailedTitle', "Couldn't unlock the number"), t('chat.unlockOffline', 'Check your connection and try again.'));
      } else {
        showToast.error(t('chat.unlockFailedTitle', "Couldn't unlock the number"), serverMessage ?? t('chat.unlockFailed', 'Try again in a moment.'));
      }
    },
  });

  // Ruling 22: this Alert stays. Spending a contact unlock is irreversible
  // (it consumes paid quota), which is the same class as a destructive confirm.
  // The client does not know whether this member's plan is capped or unlimited
  // (AuthUser carries no unlock allowance), so the copy is true for both: it
  // never names a quota, and it says a number already unlocked costs nothing
  // (the server returns it without charging).
  const handleUnlock = () => {
    Alert.alert(
      t('chat.unlockTitle', 'Unlock phone number?'),
      t('chat.unlockConfirm', 'This uses one contact unlock on your plan, unless you have already unlocked this number.'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        { text: t('chat.unlock', 'Unlock'), onPress: () => unlock() },
      ]
    );
  };

  if (phone) {
    // successAccent, not success: darkColours.success is 3.64:1 on this tint and
    // theme.ts documents it as unreadable as an accent. successAccent is 5.13:1
    // light / 6.88:1 dark. `selectable` so the number can be copied; it is the
    // whole point of paying an unlock.
    return (
      <View style={[s.contactBanner, { minHeight: tapSize(elder) }]} testID="ContactBannerUnlocked">
        <Ionicons name="call" size={16} color={c.successAccent} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Text variant="subhead" selectable style={{ color: c.successAccent }}>{phone}</Text>
      </View>
    );
  }

  return (
    <PressableScale
      style={[s.contactBanner, { minHeight: tapSize(elder) }]}
      onPress={handleUnlock}
      disabled={isPending}
      accessibilityLabel={t('chat.requestContact', 'Request phone number')}
      accessibilityRole="button"
      accessibilityState={{ disabled: isPending, busy: isPending }}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      testID="ContactUnlockBanner"
    >
      <Ionicons name="person-add-outline" size={16} color={c.primary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text variant="subhead" color="primary">{t('chat.requestContact', 'Request phone number')}</Text>
      {isPending && <ActivityIndicator size="small" color={c.primary} style={{ marginLeft: 8 }} />}
    </PressableScale>
  );
}

// ─── Message action menu ─────────────────────────────────────────────────────
interface ActionMenuProps {
  msg: Message | null;
  currentUserId: string | undefined;
  visible: boolean;
  canRich: boolean;
  onClose: () => void;
  /** iOS only: fires once the menu's fade-out has finished (see handleReport). */
  onDismissed: () => void;
  onEdit: (msg: Message) => void;
  onDelete: (msg: Message) => void;
  onReport: (msg: Message) => void;
  onReact: (msg: Message, emoji: string) => void;
  onReply: (msg: Message) => void;
}

function MessageActionMenu({ msg, currentUserId, visible, canRich, onClose, onDismissed, onEdit, onDelete, onReport, onReact, onReply }: ActionMenuProps) {
  const { c, elder, isDark } = useTheme();
  const s = getS(c);
  const { t } = useTranslation();
  const tap = tapSize(elder);
  // The parent clears `msg` the instant the menu closes, which would unmount
  // the Modal before its fade-out plays and flip Delete/Edit to Report under
  // the user's finger. Keep the last message alive for the exit.
  const lastMsg = useRef<Message | null>(null);
  if (msg) lastMsg.current = msg;
  const m = msg ?? lastMsg.current;
  if (!m) return null;
  const isOwn = m.senderId === currentUserId;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} onDismiss={onDismissed}>
      <View style={s.menuOverlay} accessibilityViewIsModal>
        {/* Backdrop: tap anywhere outside the card to dismiss. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('chat.closeMenu', 'Close menu')}
          testID="MenuBackdrop"
        />
        <View style={[s.menuCard, isDark ? darkShadows.e3 : shadows.e3]}>
          {/* D2 reactions — premium; six-emoji allowlist mirrors the server.
              The emoji ARE the content here (a reaction), not an icon stand-in. */}
          {canRich && (
            <View style={s.emojiRow}>
              {REACTION_EMOJIS.map((e) => {
                // The server toggles: tapping a reaction you already left removes
                // it. Show which ones are yours before the tap, sighted and spoken.
                const mine = !!currentUserId && !!m.reactions?.[e]?.includes(currentUserId);
                return (
                  <PressableScale
                    key={e}
                    onPress={() => { onReact(m, e); onClose(); }}
                    style={[s.emojiBtn, { width: tap, height: tap, borderRadius: tap / 2 }, mine && s.emojiBtnMine]}
                    scaleTo={0.92}
                    accessibilityLabel={mine
                      ? t('chat.removeReaction', 'Remove {{emoji}} reaction', { emoji: e })
                      : t('chat.reactWith', 'React with {{emoji}}', { emoji: e })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: mine }}
                    pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    testID={`React-${e}`}
                  >
                    <Text variant="title2" maxScale={1.3}>{e}</Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
          {canRich && (
            <PressableScale
              style={[s.menuItem, { minHeight: tap }]}
              onPress={() => { onReply(m); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.reply', 'Reply')}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="MenuReply"
            >
              <Ionicons name="return-up-back" size={18} color={c.textPrimary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              <Text variant="subhead" color="textPrimary">{t('chat.reply', 'Reply')}</Text>
            </PressableScale>
          )}
          {isOwn && canEdit(m.createdAt) && m.messageType !== 'voice' && (
            <PressableScale
              style={[s.menuItem, { minHeight: tap }]}
              onPress={() => { onEdit(m); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.edit', 'Edit')}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="MenuEdit"
            >
              <Ionicons name="pencil" size={18} color={c.textPrimary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              <Text variant="subhead" color="textPrimary">{t('chat.edit', 'Edit')}</Text>
            </PressableScale>
          )}
          {isOwn && (
            <PressableScale
              style={[s.menuItem, { minHeight: tap }]}
              onPress={() => { onDelete(m); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.delete', 'Delete')}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="MenuDelete"
            >
              <Ionicons name="trash" size={18} color={c.error} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              <Text variant="subhead" color="error">{t('chat.delete', 'Delete')}</Text>
            </PressableScale>
          )}
          {!isOwn && (
            <PressableScale
              style={[s.menuItem, { minHeight: tap }]}
              onPress={() => { onReport(m); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.report', 'Report')}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="MenuReport"
            >
              {/* The hue stays in the icon; the word is textPrimary. c.warning as
                  text is 2.70:1 on this white card, under AA at 15pt. */}
              <Ionicons name="flag" size={18} color={c.warning} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              <Text variant="subhead" color="textPrimary">{t('chat.report', 'Report')}</Text>
            </PressableScale>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChatThreadScreen() {
  const { c, elder } = useTheme();
  const s = getS(c);
  const tap = tapSize(elder);
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId, name: nameParam, photo: photoParam , draft } = route.params;

  // Callers that only know the other user's id — a "new message" notification
  // tap, for one — navigate here with an empty name, which rendered a chat with
  // a blank header. Fall back to fetching the profile so the header is correct
  // regardless of who navigated.
  const { data: fallbackProfile, isLoading: nameLoading } = useQuery({
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
  const firstName = name.split(' ')[0];

  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();
  const queryClient = useQueryClient();

  const [input, setInput] = useState(draft ?? '');
  // Mirror of `input` for the send-failure handler: it needs to know whether the
  // composer is still empty at the moment the failure lands, not when it rendered.
  const inputValueRef = useRef(input);
  inputValueRef.current = input;
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // iOS cannot present a second Modal while the first is still dismissing, so a
  // Report tap is parked here and opened from the menu's onDismiss.
  const pendingReport = useRef(false);
  // D1: live window state — seeded from the thread response, advanced by every
  // send, and flipped inactive by the local expiry timer (403 is the backstop).
  const [replyWindow, setReplyWindow] = useState<ReplyWindow | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const isPaid = (user?.subscriptionPlan ?? 'free') !== 'free';

  const { socket, emitTyping, joinThread, leaveThread } = useLiveSocket();

  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  // Read at event time so the listeners below are not torn down and re-bound
  // every time the header name loads or the language changes.
  const firstNameRef = useRef(firstName);
  firstNameRef.current = firstName;

  // Everything realtime for this thread is bound here, straight onto the live
  // socket. It used to be passed to useSocket as handler props, but each hook
  // instance owns its own handler ref and the singleton's listeners are wired
  // only by whichever instance happened to create the socket: open the Chat tab
  // first (which is what creates it) and this screen's typing dots and spoken
  // incoming messages never fired.
  useEffect(() => {
    if (!socket) return undefined;
    const seen = new Set<string>();

    const onTyping = (data: { userId: string; isTyping: boolean }) => {
      if (data?.userId !== userId) return;
      setIsOtherTyping(data.isTyping);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (data.isTyping) typingTimer.current = setTimeout(() => setIsOtherTyping(false), 5000);
    };

    // A message from the other person lands without the user touching anything.
    // Sighted users see the row appear; a screen reader has to be told. The server
    // can deliver the same message to more than one room, hence the id set.
    const onNewMessage = (data: { message?: Message }) => {
      const msg = data?.message;
      if (!msg?.id || msg.senderId !== userId || seen.has(msg.id)) return;
      seen.add(msg.id);
      if (seen.size > 50) seen.clear();
      const who = firstNameRef.current || t('chat.theyShort', 'They');
      AccessibilityInfo.announceForAccessibility(
        msg.messageType === 'voice'
          ? t('chat.a11yVoiceFrom', '{{name}} sent a voice message', { name: who })
          : `${who}: ${msg.content}`
      );
    };

    // Join the pair room so the server-authoritative broadcasts (and the typing
    // relay, which is pair-room only) reach this device. Room membership lives on
    // the server-side socket, so a reconnect loses it: re-join on every 'connect'.
    // An already-connected socket will not fire 'connect' again, so join now.
    const join = () => joinThread(userId);
    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('user_typing', onTyping);
    socket.on('message:new', onNewMessage);
    return () => {
      socket.off('connect', join);
      socket.off('user_typing', onTyping);
      socket.off('message:new', onNewMessage);
      leaveThread(userId);
    };
  }, [socket, userId, joinThread, leaveThread, t]);

  // Load thread (cursor-based, scroll up = load more)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
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
  const messages: Message[] = useMemo(() => data?.pages.flatMap((p) => p.messages) ?? [], [data]);

  // Send message
  // The quote target travels WITH the send (as a variable, and back out through
  // the mutation context) rather than being read from `replyingTo` state, which
  // handleSend clears the instant it fires. That is what lets a failed reply put
  // its quote back.
  const { mutate: doSend, isPending: isSending } = useMutation({
    mutationFn: ({ content, replyTarget }: { content: string; replyTarget: Message | null }) =>
      sendMessage(userId, content, replyTarget?.id),
    onMutate: async ({ content, replyTarget }) => {
      const optimistic: Message = {
        id: `tmp-${Date.now()}`,
        senderId: user!.id,
        receiverId: userId,
        content,
        messageType: 'text',
        mediaUrl: null,
        mediaDurationMs: null,
        replyToId: replyTarget?.id ?? null,
        ReplyTo: replyTarget
          ? { id: replyTarget.id, content: replyTarget.content, messageType: replyTarget.messageType, senderId: replyTarget.senderId }
          : null,
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
      return { optimistic, replyTarget };
    },
    onError: (err, { content }, ctx) => {
      // 403 backstop: trust the server's window state; the paywalled composer
      // takes over.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errBody = (err as any)?.response?.data?.error;
      if (errBody?.code === 'REPLY_WINDOW_ENDED') {
        setReplyWindow(errBody.replyWindow ?? { active: false, messagesRemaining: 0, messagesUsed: FREE_REPLY_MAX_MESSAGES, firstReplyAt: null, expiresAt: null });
      } else if (!inputValueRef.current.trim()) {
        // The optimistic row is removed below and the composer was already
        // cleared, so without this the message just vanished. The composer is
        // still empty, so the text (and the quote it was replying to) goes back
        // in and sending again is one tap.
        showToast.error(
          t('chat.sendFailed', 'Message not sent'),
          t('chat.sendFailedBody', 'Your message is back in the box. Try again.')
        );
        setInput(content);
        if (ctx?.replyTarget) setReplyingTo((cur) => cur ?? ctx.replyTarget);
      } else {
        // The user has already started something new. Putting the failed text
        // back would clobber it and swapping them would surprise, so leave the
        // composer alone and do not claim otherwise: quote what was lost.
        const preview = content.length > 60 ? `${content.slice(0, 59)}…` : content;
        showToast.error(
          t('chat.sendFailed', 'Message not sent'),
          t('chat.sendFailedKept', '"{{text}}" was not sent. Try again.', { text: preview })
        );
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
  const { mutate: doEdit, isPending: isEditing } = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => editMessage(id, content),
    // The edit banner and the text stay put until the server accepts the change,
    // so a failure leaves the user where they were with a working retry.
    onError: () => {
      showToast.error(
        t('chat.editFailed', "Couldn't save your edit"),
        t('chat.editFailedBody', 'Your changes are still here. Try again.')
      );
    },
    onSuccess: (updated) => {
      setEditingMsg(null);
      setInput('');
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
    onError: () => {
      showToast.error(t('chat.deleteFailed', "Couldn't delete the message"), t('chat.deleteFailedBody', 'Check your connection and try again.'));
    },
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

  // D2: reaction toggle. Not optimistic: the server owns the toggle (it may add
  // or remove), so the cache takes the reactions map it answers with.
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
      // Cleared in doEdit's onSuccess, not here: see the mutation.
      doEdit({ id: editingMsg.id, content: text });
      emitTyping(userId, false);
      return;
    }
    doSend({ content: text, replyTarget: replyingTo });
    setReplyingTo(null);
    setInput('');
    emitTyping(userId, false);
  }, [input, editingMsg, replyingTo, doSend, doEdit, emitTyping, userId]);

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
        t('chat.deleteTitle', 'Delete message?'),
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

  // This used to raise a "Report submitted" success toast and send nothing.
  // It now opens the real report sheet (POST /report/:userId). The menu and the
  // sheet are both Modals: on iOS the second one must wait for the first to
  // finish dismissing, so iOS parks the request for the menu's onDismiss.
  const handleReport = useCallback(() => {
    if (Platform.OS === 'ios') pendingReport.current = true;
    else setReportOpen(true);
  }, []);
  const handleMenuDismissed = useCallback(() => {
    if (pendingReport.current) {
      pendingReport.current = false;
      setReportOpen(true);
    }
  }, []);

  const openActions = useCallback((msg: Message) => setSelectedMsg(msg), []);

  // Render list item with optional date separator
  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isOwn = item.senderId === user?.id;
      const prev = messages[index + 1];
      const showDate = !prev || !isSameDay(item.createdAt, prev.createdAt);

      return (
        <>
          {showDate && <DateSeparator iso={item.createdAt} />}
          <MessageBubble msg={item} isOwn={isOwn} senderName={name} onOpenActions={openActions} />
        </>
      );
    },
    [messages, user?.id, name, openActions]
  );

  // iOS has no accessibilityLiveRegion, so the reply meter (D1) is announced
  // explicitly whenever the count moves, but not on first load. Android already
  // speaks it through the meter's own live region, so announcing there too made
  // it say the same line twice.
  const lastAnnouncedLeft = useRef<number | null>(null);
  useEffect(() => {
    if (!isGrantThread || !replyWindow?.active) return;
    const left = replyWindow.messagesRemaining;
    if (Platform.OS === 'ios' && lastAnnouncedLeft.current !== null && lastAnnouncedLeft.current !== left) {
      AccessibilityInfo.announceForAccessibility(repliesLeftText(t, left));
    }
    lastAnnouncedLeft.current = left;
  }, [isGrantThread, replyWindow?.active, replyWindow?.messagesRemaining, t]);

  // Announce the reply/edit banners when they appear: focus was on the menu
  // that just closed, so nothing else tells a screen-reader user they took hold.
  useEffect(() => {
    if (replyingTo) {
      AccessibilityInfo.announceForAccessibility(
        t('chat.a11yReplying', 'Replying to {{text}}', {
          text: replyingTo.messageType === 'voice' ? t('chat.voiceMessage', 'Voice message') : replyingTo.content,
        })
      );
    }
  }, [replyingTo, t]);
  useEffect(() => {
    if (editingMsg) AccessibilityInfo.announceForAccessibility(t('chat.a11yEditing', 'Editing message'));
  }, [editingMsg, t]);

  // The way back must exist in every state: loading and error included (the
  // loading branch used to render a bare skeleton with no header at all).
  const header = (
    <View style={[s.header, { paddingTop: spacing.sm }]}>
      <PressableScale
        onPress={() => navigation.goBack()}
        style={[s.headerIconBtn, { width: tap, height: tap }]}
        accessibilityLabel={t('back', 'Back')}
        accessibilityRole="button"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID="BackBtn"
      >
        <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
      </PressableScale>

      <PressableScale
        style={[s.headerProfile, { minHeight: tap }]}
        onPress={() => navigation.navigate('ProfileDetail', { userId })}
        // No name yet (a notification-tap entry while the profile loads, or the
        // fetch failed): never speak "View 's profile".
        accessibilityLabel={name
          ? t('chat.viewProfileA11y', "View {{name}}'s profile", { name })
          : t('chat.viewProfileNoName', 'View profile')}
        accessibilityRole="button"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID="HeaderProfile"
      >
        <SmartImage uri={photo} name={name} style={s.headerAvatar} initialSize={16} />

        {name ? (
          <Text variant="subhead" color="textPrimary" style={s.headerName} numberOfLines={1}>{name}</Text>
        ) : nameLoading ? (
          // The title is on its way: a placeholder bar, not a blank header.
          <View style={s.headerName}>
            <SkeletonBlock width={120} height={14} />
          </View>
        ) : (
          <Text variant="subhead" color="textPrimary" style={s.headerName} numberOfLines={1}>
            {t('chat.conversationTitle', 'Conversation')}
          </Text>
        )}
      </PressableScale>

      {/* Calls are config-gated on the Agora credentials, matching the web app
          (which hides its call UI when VITE_AGORA_APP_ID is unset). Without
          them these buttons navigate to a screen that cannot connect, so they
          are hidden rather than shown-and-broken. Starting a call is a commit,
          so these two keep their haptic. */}
      <View style={s.headerActions}>
        {CONFIG.IS_AGORA_CONFIGURED && (
        <>
        <PressableScale
          scaleTo={0.9}
          haptic
          style={[s.headerIconBtn, { width: tap, height: tap }]}
          onPress={() => navigation.navigate('VoiceCall', { calleeId: userId, channelName: `voice_${userId}` })}
          accessibilityLabel={t('chat.voiceCall', 'Voice call')}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="VoiceCallBtn"
        >
          <Ionicons name="call-outline" size={22} color={c.textPrimary} />
        </PressableScale>
        <PressableScale
          scaleTo={0.9}
          haptic
          style={[s.headerIconBtn, { width: tap, height: tap }]}
          onPress={() => navigation.navigate('VideoCall', { calleeId: userId, channelName: `video_${userId}`, callType: 'video' })}
          accessibilityLabel={t('chat.videoCall', 'Video call')}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="VideoCallBtn"
        >
          <Ionicons name="videocam-outline" size={22} color={c.textPrimary} />
        </PressableScale>
        </>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <Screen edges={['top']} testID="ChatThreadLoading">
        {header}
        <ChatThreadSkeleton />
      </Screen>
    );
  }

  // Deep-link hole (C2): a free member can land here from a notification tap.
  // A 403 renders a real gate instead of an empty thread that errors on send.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((threadError as any)?.response?.status === 403) {
    return (
      <Screen edges={['top']} style={s.gateWrap} testID="ChatThreadGate">
        <PressableScale
          onPress={() => navigation.goBack()}
          style={[s.gateBack, { width: tap, height: tap }]}
          accessibilityLabel={t('back', 'Back')}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
        <View style={s.gateBody}>
          <View style={s.gateIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="lock-closed" size={32} color={c.secondary} />
          </View>
          <Text variant="title3" color="textPrimary" style={s.gateTitle} accessibilityRole="header">{t('chat.gateTitle', 'Chat is a Premium feature')}</Text>
          <Text variant="footnote" color="textMuted" style={s.gateLine}>
            {t('chat.gateLine', 'Upgrade to start the conversation with {{name}}.', { name: name || 'your match' })}
          </Text>
          <Button
            title={t('chat.gateCta', 'See plans')}
            variant="gold"
            onPress={() => navigation.navigate('Subscription')}
            testID="ChatGateUpgrade"
            style={s.gateCta}
          />
        </View>
      </Screen>
    );
  }

  const windowEnded = isGrantThread && replyWindow != null && !replyWindow.active;
  // The 5 and the 48 come from the shared chat constants, so retuning the window
  // cannot leave the paywall copy quoting the old figures.
  const endHeadline = replyWindow?.messagesRemaining === 0
    ? t('chat.windowExhausted', {
        count: FREE_REPLY_MAX_MESSAGES,
        defaultValue: "You've used your {{count}} free reply",
        defaultValue_plural: "You've used your {{count}} free replies",
      })
    : t('chat.windowExpired', 'Your {{hours}}-hour reply window ended', { hours: Math.round(FREE_REPLY_WINDOW_MS / 3_600_000) });

  // A failed load with nothing cached must not fall through to an empty thread
  // and a live composer (the 403 gate above is the one failure that has its own
  // screen). A failed background refetch or next-page fetch keeps the thread.
  const showError = isError && !data;

  // With the keyboard down the composer clears the home indicator; with it up
  // the keyboard already covers that strip.
  const composerBottom = keyboardUp ? spacing.xs : Math.max(insets.bottom, spacing.xs);
  const canSend = !!input.trim() && !isSending && !isEditing;

  return (
    // The stack sets headerShown:false, so this view starts at the top of the
    // screen and the KAV needs no offset. (It was 90, a native-header height,
    // which pushed the composer 90pt clear of the keyboard on iOS.)
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Screen edges={['top']}>
      {header}

      {showError ? (
        <View style={s.errorBody}>
          <EmptyState
            variant="error"
            icon="chatbubbles-outline"
            title={t('chat.loadFailedTitle', "Couldn't load messages")}
            description={t('chat.loadFailedBody', 'Check your connection and try again.')}
            actionLabel={t('chat.tryAgain', 'Try again')}
            onAction={() => refetch()}
            testID="ChatThreadScreen-error"
          />
        </View>
      ) : (
      <>
      {/* Contact unlock banner */}
      <ContactUnlockBanner userId={userId} onUnlocked={() => {}} />

      {/* Message list (inverted — newest at bottom) */}
      <FlatList
        {...CHAT_LIST_PERF}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        inverted
        // Rows open a menu on tap now; with the keyboard up the first tap must
        // reach the row instead of only dismissing the keyboard.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[s.listContent, messages.length === 0 && s.listContentEmpty]}
        onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.2}
        ListEmptyComponent={
          <View style={s.emptyBody}>
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title={t('chat.threadEmptyTitle', 'No messages yet')}
              description={t('chat.threadEmptyBody', 'Say hello to {{name}} and start the conversation.', { name: firstName || 'your match' })}
              actionLabel={t('chat.threadEmptyAction', 'Write a message')}
              onAction={() => inputRef.current?.focus()}
              testID="ChatThreadScreen-empty"
            />
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator
              size="small"
              color={c.primary}
              style={{ marginVertical: spacing.sm }}
              accessibilityLabel={t('chat.loadingOlder', 'Loading earlier messages')}
            />
          ) : null
        }
        ListHeaderComponent={isOtherTyping ? <TypingIndicator name={firstName || t('chat.theyShort', 'They')} /> : null}
      />

      {/* Edit banner */}
      {editingMsg && (
        <View style={[s.editBanner, { minHeight: tap }]} testID="EditBanner">
          <Ionicons name="pencil" size={14} color={c.primary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <Text variant="caption" color="primary" style={s.editBannerText} numberOfLines={1}>{editingMsg.content}</Text>
          <PressableScale
            onPress={() => { setEditingMsg(null); setInput(''); }}
            style={[s.bannerClose, { width: tap, height: tap }]}
            accessibilityLabel={t('chat.cancelEdit', 'Cancel edit')}
            accessibilityRole="button"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={c.textMuted} />
          </PressableScale>
        </View>
      )}

      {/* Reply-quote banner (D2, premium) */}
      {replyingTo && !editingMsg && (
        <View style={[s.editBanner, { minHeight: tap }]} testID="ReplyBanner">
          <Ionicons name="return-up-back" size={14} color={c.primary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <Text variant="caption" color="primary" style={s.editBannerText} numberOfLines={1}>
            {replyingTo.messageType === 'voice' ? t('chat.voiceMessage', 'Voice message') : replyingTo.content}
          </Text>
          <PressableScale
            onPress={() => setReplyingTo(null)}
            style={[s.bannerClose, { width: tap, height: tap }]}
            accessibilityLabel={t('chat.cancelReply', 'Cancel reply')}
            accessibilityRole="button"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={c.textMuted} />
          </PressableScale>
        </View>
      )}

      {windowEnded ? (
        /* DS1: scripted paywalled composer — thread stays readable above. */
        <View style={[s.paywallBar, { paddingBottom: composerBottom }]} testID="PaywalledComposer">
          <View style={{ flex: 1 }}>
            <Text variant="subhead" color="textPrimary">{endHeadline}</Text>
            <Text variant="caption" color="textMuted" style={s.paywallLine}>
              {t('chat.windowKeepTalking', '{{name}} can still write to you. Upgrade to keep talking.', { name: (name || 'They').split(' ')[0] })}
            </Text>
          </View>
          {/* Upgrade CTA = premium = gold. It was white text on flat gold (~2.4:1);
              the Button's gold variant carries the dark goldText for contrast. */}
          <Button
            title={t('chat.upgrade', 'Upgrade')}
            variant="gold"
            size="sm"
            onPress={() => navigation.navigate('Subscription')}
            testID="PaywallUpgrade"
          />
        </View>
      ) : showRecorder ? (
        <View style={[s.composerDock, { paddingBottom: composerBottom }]}>
          <VoiceRecorderStrip onSend={sendVoice} onClose={() => setShowRecorder(false)} />
        </View>
      ) : (
      <View style={[s.composerDock, { paddingBottom: composerBottom }]}>
        <View style={s.inputBar}>
          <Input
            ref={inputRef}
            containerStyle={s.inputContainer}
            style={s.input}
            value={input}
            onChangeText={handleInputChange}
            placeholder={t('chat.typePlaceholder', 'Type a message…')}
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
              style={[s.micBtn, { width: tap, height: tap, borderRadius: tap / 2 }]}
              onPress={() => setShowRecorder(true)}
              accessibilityLabel={t('chat.recordVoice', 'Record a voice message')}
              accessibilityRole="button"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="MicBtn"
            >
              <Ionicons name="mic-outline" size={20} color={c.textSecondary} />
            </PressableScale>
          )}
          <PressableScale
            scaleTo={0.9}
            haptic
            style={[s.sendBtn, { width: tap, height: tap, borderRadius: tap / 2 }, !canSend && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
            accessibilityLabel={editingMsg ? t('chat.saveEdit', 'Save edit') : t('chat.send', 'Send')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend, busy: isSending || isEditing }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="SendBtn"
          >
            {isSending || isEditing ? (
              <ActivityIndicator size="small" color={c.onPrimary} />
            ) : (
              <Ionicons name="send" size={18} color={!input.trim() ? c.textMuted : c.onPrimary} />
            )}
          </PressableScale>
        </View>
        {/* DS3: the meter is last in the hierarchy — muted, warns at ≤2.
            The warning is the icon (semantic hue) and the full-strength text:
            c.warning as 12pt text is 2.70:1 on this white dock, under AA.
            Gold is reserved for premium. */}
        {isGrantThread && replyWindow?.active && (
          <View style={s.meterRow}>
            {replyWindow.messagesRemaining <= 2 && (
              <Ionicons
                name="alert-circle-outline"
                size={14}
                color={c.warning}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            )}
            <Text
              variant="caption"
              color={replyWindow.messagesRemaining <= 2 ? 'textPrimary' : 'textMuted'}
              style={s.meterText}
              accessibilityLiveRegion="polite"
              testID="ReplyMeter"
            >
              {repliesLeftText(t, replyWindow.messagesRemaining)}
            </Text>
          </View>
        )}
      </View>
      )}
      </>
      )}

      {/* Long-press / tap action menu */}
      <MessageActionMenu
        msg={selectedMsg}
        currentUserId={user?.id}
        visible={selectedMsg !== null}
        canRich={isPaid}
        onClose={() => setSelectedMsg(null)}
        onDismissed={handleMenuDismissed}
        onEdit={(msg) => { setEditingMsg(msg); setInput(msg.content); }}
        onDelete={handleDeletePrompt}
        onReport={handleReport}
        onReact={(msg, emoji) => doReact({ id: msg.id, emoji })}
        onReply={setReplyingTo}
      />

      <BlockReportSheet
        visible={reportOpen}
        userId={userId}
        userName={name || t('chat.theyShort', 'They')}
        onClose={() => setReportOpen(false)}
        onBlocked={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
          navigation.goBack();
        }}
      />
      </Screen>
    </KeyboardAvoidingView>
  );
}

/**
 * Stylesheets are a pure function of the palette and only two palettes exist, so
 * they are built once per palette rather than once per row instance. Rows remount
 * as they scroll back into the window (and swap key when an optimistic id is
 * replaced by the server's), which used to rebuild this ~60-entry sheet each time.
 * `c` is always the `colours` / `darkColours` singleton from useTheme().
 */
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
  // ── Phase C additions ──────────────────────────────────────────────────────
  quoteBlock: {
    borderLeftWidth: 2,
    paddingLeft: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
    borderRadius: 4,
  },
  // White-on-burgundy tints: the own bubble is the fixed p500 fill in both themes
  // and its text is c.onPrimary (#FFFFFF), so these are that token at low alpha
  // (8-digit hex: 0x80 = 50%, 0x1F = 12%) rather than a literal or a
  // theme-dependent surface.
  quoteBlockOwn: { borderLeftColor: c.onPrimary + '80', backgroundColor: c.onPrimary + '1F' },
  quoteBlockTheirs: { borderLeftColor: c.primary, backgroundColor: c.surface2 },
  reactionRow: { flexDirection: 'row', gap: 4, marginTop: 2, marginHorizontal: spacing.md },
  reactionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: c.surfaceCard, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2,
  },
  reactionCount: { fontVariant: ['tabular-nums'] },
  // Six 48pt targets are ~290pt; in elder mode (60pt) they must wrap rather than clip.
  emojiRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    paddingHorizontal: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: spacing.xs,
  },
  // Target size (48 / 60 elder) and radius are applied inline from tapSize().
  emojiBtn: { alignItems: 'center', justifyContent: 'center' },
  // A reaction this member already left: the border sits inside the fixed box.
  emojiBtnMine: { backgroundColor: c.accentSoft, borderWidth: 1.5, borderColor: c.primary },
  micBtn: {
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.xs,
  },
  meterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingTop: 4,
  },
  meterText: { fontVariant: ['tabular-nums'] },
  paywallBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surfaceCard,
  },
  paywallLine: { marginTop: 2 },
  gateWrap: { flex: 1, backgroundColor: c.background },
  gateBack: { alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  gateBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  gateIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: c.goldSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  gateTitle: {
    textAlign: 'center', marginBottom: spacing.xs,
  },
  gateLine: { textAlign: 'center', marginBottom: spacing.lg },
  gateCta: { minWidth: 200 },

  container: {
    flex: 1,
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
  // Size (48 / 60 elder) is applied inline from tapSize().
  headerIconBtn: { alignItems: 'center', justifyContent: 'center' },
  bannerClose: { alignItems: 'center', justifyContent: 'center', marginRight: -spacing.sm },
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
  headerName: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  // List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // Empty thread: let the content container fill the list so the empty state centres.
  listContentEmpty: { flexGrow: 1 },
  emptyBody: { flex: 1, justifyContent: 'center' },
  errorBody: { flex: 1, justifyContent: 'center' },
  // Bubbles
  bubbleRow: {
    marginVertical: 2,
  },
  // The press area is the bubble itself, not the whole row: a tap in the empty
  // space beside a short message must not open its menu.
  bubbleWrap: {
    maxWidth: '78%',
  },
  pendingRow: { opacity: 0.5 },
  bubbleRowOwn: {
    alignItems: 'flex-end',
  },
  bubbleRowTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.lg,
  },
  bubbleOwn: {
    // p500 is #8B2346 in both palettes (white on it ~10:1); c.primary is the
    // lighter #C75D7E accent in dark mode (white on it is ~3.96:1, under AA).
    backgroundColor: c.p500,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: c.surfaceCard,
    borderWidth: 1,
    borderColor: c.border,
    borderBottomLeftRadius: 4,
  },
  editedTag: {
    marginTop: 2,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
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
  // Edit banner
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: c.primaryLight + '20',
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  editBannerText: {
    flex: 1,
  },
  // The composer's surface. The bottom-inset padding lives on this wrapper, so
  // the surface (and the hairline above it) must too: with the colour only on
  // the bar, the home-indicator strip underneath painted the screen background
  // and read as a second band, most visibly in dark mode.
  composerDock: {
    backgroundColor: c.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  // Input primitive owns border/radius/padding/type/colour; only the
  // composer-specific sizing (compact + capped growth) and the background
  // (contrast against the surfaceCard bar behind it) are kept here.
  inputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  input: {
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: c.background,
  },
  // Target size (48 / 60 elder) and radius are applied inline from tapSize().
  // p500 for the same reason as bubbleOwn: the arrow is white on it.
  sendBtn: {
    backgroundColor: c.p500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: c.n200,
  },
  // Action menu
  menuOverlay: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs,
    minWidth: 200,
    maxWidth: '92%',
    // Elevation comes from the token tables (light burgundy-tint, dark black),
    // applied inline where isDark is known.
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
