import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import Text from '../../components/ui/Text';
import { PressableScale } from '../../components/motion';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ChatThreadSkeleton } from '../../components/ui/skeletons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import {
  getGroupThread,
  sendGroupMessage,
  inviteToFamilyGroup,
  leaveFamilyGroup,
  type GroupMessage,
  type FamilyGroup,
} from '../../api/chat';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'FamilyGroupChat'>;

// ─── Date separator ───────────────────────────────────────────────────────────

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (isSameDay(iso, today.toISOString())) return 'Today';
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (isSameDay(iso, yest.toISOString())) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  msg: GroupMessage;
  isOwn: boolean;
  showSender: boolean;
}

function GroupMessageBubble({ msg, isOwn, showSender }: BubbleProps) {
  const { c } = useTheme();
  const bub = React.useMemo(() => makeBub(c), [c]);
  return (
    <View style={[bub.row, isOwn && bub.rowOwn]}>
      <View style={[bub.bubble, isOwn ? bub.ownBubble : bub.theirBubble]}>
        {!isOwn && showSender && (
          <Text variant="caption" color="primary" style={bub.senderName}>{msg.senderName}</Text>
        )}
        <Text variant="callout" color="textPrimary" style={isOwn && bub.ownContent}>{msg.content}</Text>
        <View style={bub.meta}>
          {msg.editedAt && <Text variant="micro" color="textMuted" style={isOwn && bub.ownMeta}>edited · </Text>}
          <Text variant="micro" color="textMuted" style={isOwn && bub.ownMeta}>{formatTime(msg.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

const makeBub = (c: ThemeColours) => StyleSheet.create({
  row:        { flexDirection: 'row', marginVertical: 2, paddingHorizontal: spacing.md },
  rowOwn:     { justifyContent: 'flex-end' },
  bubble:     { maxWidth: '75%', borderRadius: borderRadius.lg, padding: spacing.sm, paddingHorizontal: spacing.md },
  ownBubble:  { backgroundColor: c.primary, borderBottomRightRadius: 4 },
  theirBubble:{ backgroundColor: c.surfaceCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
  senderName: { marginBottom: 2 },
  ownContent: { color: '#fff' },
  meta:       { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  ownMeta:    { color: 'rgba(255,255,255,0.7)' },
});

// ─── Invite modal ─────────────────────────────────────────────────────────────

interface InviteModalProps {
  visible: boolean;
  groupId: string;
  onClose: () => void;
}

const RELATION_OPTIONS = ['Father', 'Mother', 'Brother', 'Sister', 'Uncle', 'Aunt', 'Other'];

function InviteModal({ visible, groupId, onClose }: InviteModalProps) {
  const { c } = useTheme();
  const im = React.useMemo(() => makeIm(c), [c]);
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('Father');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (phone.trim().length < 10) {
      Alert.alert('Invalid', 'Enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      await inviteToFamilyGroup(groupId, phone.trim(), relation);
      Alert.alert('Invited!', `Invitation sent to ${phone}. They will join via SMS link.`);
      setPhone('');
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={im.overlay}>
        <View style={im.sheet}>
          <View style={im.handle} />
          <Text variant="title3" color="textPrimary" style={im.title}>Invite Family Member</Text>

          <Text variant="subhead" color="textSecondary" style={im.label}>Phone Number</Text>
          <TextInput
            style={im.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
            maxLength={13}
            testID="invite-phone-input"
            accessibilityLabel="Phone number for invite"
          />

          <Text variant="subhead" color="textSecondary" style={im.label}>Relation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {RELATION_OPTIONS.map((r) => (
                <PressableScale
                  key={r}
                  style={[im.chip, relation === r && im.chipActive]}
                  onPress={() => setRelation(r)}
                  accessibilityLabel={`Select relation ${r}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: relation === r }}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  testID={`relation-chip-${r}`}
                >
                  <Text variant="subhead" color={relation === r ? 'primary' : 'textSecondary'}>{r}</Text>
                </PressableScale>
              ))}
            </View>
          </ScrollView>

          <PressableScale
            style={im.sendBtn}
            onPress={handleInvite}
            disabled={loading}
            accessibilityLabel="Send invite"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="send-invite-btn"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text variant="headline" style={im.sendText}>Send Invite via SMS</Text>
            )}
          </PressableScale>

          <PressableScale
            style={im.cancelBtn}
            onPress={onClose}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="cancel-invite-btn"
          >
            <Text variant="callout" color="textSecondary">Cancel</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const makeIm = (c: ThemeColours) => StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:         { backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  handle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
  title:         { marginBottom: spacing.lg },
  label:         { marginBottom: spacing.xs },
  input:         { borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.base, color: c.textPrimary, marginBottom: spacing.lg },
  chip:          { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceCard },
  chipActive:    { borderColor: c.primary, backgroundColor: c.primaryLight },
  sendBtn:       { backgroundColor: c.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  sendText:      { color: '#fff' },
  cancelBtn:     { alignItems: 'center', paddingVertical: spacing.sm },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilyGroupChatScreen() {
  const { c } = useTheme();
  const sep = React.useMemo(() => makeSep(c), [c]);
  const s = React.useMemo(() => makeS(c), [c]);
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupId, groupName, memberCount } = route.params;

  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { socket } = useSocket();

  const [text, setText] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const listRef = useRef<FlatList<GroupMessage>>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: queryKeys.groupThread(groupId),
    queryFn: ({ pageParam }) => getGroupThread(groupId, pageParam as string | undefined),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30 * 1000,
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
      queryClient.setQueryData<{ pages: { messages: GroupMessage[]; nextCursor: string | null }[] }>(
        queryKeys.groupThread(groupId),
        (old) => {
          if (!old) return old;
          const pages = [...old.pages];
          if (pages.length > 0) {
            pages[0] = { ...pages[0], messages: [optimistic, ...pages[0].messages] };
          }
          return { ...old, pages };
        }
      );
    },
    onError: () => Alert.alert('Error', 'Failed to send message.'),
  });

  // Listen for incoming group messages via socket
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: GroupMessage) => {
      if (msg.groupId !== groupId) return;
      queryClient.setQueryData<{ pages: { messages: GroupMessage[]; nextCursor: string | null }[] }>(
        queryKeys.groupThread(groupId),
        (old) => {
          if (!old) return old;
          const pages = [...old.pages];
          if (pages.length > 0) {
            pages[0] = { ...pages[0], messages: [msg, ...pages[0].messages] };
          }
          return { ...old, pages };
        }
      );
    };
    socket.on('group-message-received', handler);
    socket.emit('join-group', { groupId });
    return () => {
      socket.off('group-message-received', handler);
    };
  }, [socket, groupId, queryClient]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    sendMutation.mutate(trimmed);
  }, [text, sendMutation]);

  const handleLeave = () => {
    Alert.alert('Leave Group', 'Leave this family group chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveFamilyGroup(groupId);
            queryClient.invalidateQueries({ queryKey: queryKeys.familyGroups });
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Failed to leave group.');
          }
        },
      },
    ]);
  };

  const messages = data?.pages.flatMap((p) => p.messages) ?? [];

  const renderItem = useCallback(({ item, index }: { item: GroupMessage; index: number }) => {
    const isOwn = item.senderId === user?.id;
    const prev = messages[index + 1];
    const showDate = !prev || !isSameDay(item.createdAt, prev.createdAt);
    const showSender = !isOwn && (!prev || prev.senderId !== item.senderId || !isSameDay(item.createdAt, prev.createdAt));

    return (
      <>
        {showDate && (
          <View style={sep.container}>
            <Text variant="caption" color="textMuted" style={sep.label}>{formatDateLabel(item.createdAt)}</Text>
          </View>
        )}
        <GroupMessageBubble msg={item} isOwn={isOwn} showSender={showSender} />
      </>
    );
  }, [messages, user]);

  return (
    <KeyboardAvoidingView
      style={s.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      testID="FamilyGroupChatScreen"
    >
      {/* Header */}
      <View style={s.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="back-btn"
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <View style={s.headerInfo}>
          <View style={s.groupAvatarCircle}>
            <Ionicons name="people" size={18} color="#fff" />
          </View>
          <View>
            <Text variant="headline" color="textPrimary">{groupName}</Text>
            <Text variant="caption" color="textSecondary">{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <PressableScale
            style={s.headerBtn}
            onPress={() => setShowInvite(true)}
            accessibilityLabel="Invite family member"
            accessibilityRole="button"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="invite-btn"
          >
            <Ionicons name="person-add-outline" size={22} color={c.primary} />
          </PressableScale>
          <PressableScale
            style={s.headerBtn}
            onPress={handleLeave}
            accessibilityLabel="Leave group"
            accessibilityRole="button"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="leave-btn"
          >
            <Ionicons name="exit-outline" size={22} color={c.error} />
          </PressableScale>
        </View>
      </View>

      {/* Family group notice banner */}
      <View style={s.noticeBanner}>
        <Ionicons name="information-circle-outline" size={14} color={c.primary} style={{ marginRight: 4 }} />
        <Text variant="caption" color="primary">Family group · Only members you invite can see this chat</Text>
      </View>

      {/* Messages */}
      {isLoading ? (
        <ChatThreadSkeleton />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={s.listContent}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator size="small" color={c.primary} style={{ marginVertical: spacing.md }} /> : null}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={c.textMuted} />
              <Text variant="headline" color="textSecondary">Start the Conversation</Text>
              <Text variant="subhead" color="textMuted" style={s.emptyHint}>Share updates with your family about this match</Text>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Message your family…"
          placeholderTextColor={c.textMuted}
          multiline
          maxLength={2000}
          testID="message-input"
          accessibilityLabel="Message input"
        />
        <PressableScale
          style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
          accessibilityLabel="Send message"
          accessibilityRole="button"
          accessibilityState={{ disabled: !text.trim() }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="send-btn"
        >
          <Ionicons name="send" size={20} color={text.trim() ? '#fff' : c.textMuted} />
        </PressableScale>
      </View>

      <InviteModal visible={showInvite} groupId={groupId} onClose={() => setShowInvite(false)} />
    </KeyboardAvoidingView>
  );
}

const makeSep = (c: ThemeColours) => StyleSheet.create({
  container: { alignItems: 'center', marginVertical: spacing.md },
  label:     { backgroundColor: c.surfaceCard, paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: borderRadius.full },
});

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:          { flex: 1, backgroundColor: c.background },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn:          { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerInfo:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupAvatarCircle:{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  headerActions:    { flexDirection: 'row', gap: 4 },
  headerBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  noticeBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: c.primaryLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  loadingState:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent:      { paddingVertical: spacing.md },
  emptyState:       { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: 80, transform: [{ scaleY: -1 }] },
  emptyHint:        { textAlign: 'center' },
  inputBar:         { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background, gap: spacing.sm },
  input:            { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 120, fontSize: typography.fontSize.base, color: c.textPrimary, backgroundColor: c.surfaceCard },
  sendBtn:          { width: 42, height: 42, borderRadius: 21, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:  { backgroundColor: c.surfaceCard },
});
