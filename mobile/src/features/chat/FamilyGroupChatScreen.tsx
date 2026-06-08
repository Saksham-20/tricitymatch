import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
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
  return (
    <View style={[bub.row, isOwn && bub.rowOwn]}>
      <View style={[bub.bubble, isOwn ? bub.ownBubble : bub.theirBubble]}>
        {!isOwn && showSender && (
          <Text style={bub.senderName}>{msg.senderName}</Text>
        )}
        <Text style={[bub.content, isOwn && bub.ownContent]}>{msg.content}</Text>
        <View style={bub.meta}>
          {msg.editedAt && <Text style={[bub.metaText, isOwn && bub.ownMeta]}>edited · </Text>}
          <Text style={[bub.metaText, isOwn && bub.ownMeta]}>{formatTime(msg.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

const bub = StyleSheet.create({
  row:        { flexDirection: 'row', marginVertical: 2, paddingHorizontal: spacing.md },
  rowOwn:     { justifyContent: 'flex-end' },
  bubble:     { maxWidth: '75%', borderRadius: borderRadius.lg, padding: spacing.sm, paddingHorizontal: spacing.md },
  ownBubble:  { backgroundColor: colours.primary, borderBottomRightRadius: 4 },
  theirBubble:{ backgroundColor: colours.surfaceCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colours.border },
  senderName: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold, color: colours.primary, marginBottom: 2 },
  content:    { fontSize: typography.fontSize.base, color: colours.textPrimary, lineHeight: 22 },
  ownContent: { color: '#fff' },
  meta:       { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  metaText:   { fontSize: 10, color: colours.textMuted },
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
          <Text style={im.title}>Invite Family Member</Text>

          <Text style={im.label}>Phone Number</Text>
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

          <Text style={im.label}>Relation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {RELATION_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[im.chip, relation === r && im.chipActive]}
                  onPress={() => setRelation(r)}
                  testID={`relation-chip-${r}`}
                  accessibilityLabel={`Select relation ${r}`}
                >
                  <Text style={[im.chipText, relation === r && im.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={im.sendBtn}
            onPress={handleInvite}
            disabled={loading}
            testID="send-invite-btn"
            accessibilityLabel="Send invite"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={im.sendText}>Send Invite via SMS</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={im.cancelBtn} onPress={onClose} testID="cancel-invite-btn" accessibilityLabel="Cancel">
            <Text style={im.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const im = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:         { backgroundColor: colours.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  handle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: colours.border, alignSelf: 'center', marginBottom: spacing.lg },
  title:         { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.lg },
  label:         { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: colours.textSecondary, marginBottom: spacing.xs },
  input:         { borderWidth: 1, borderColor: colours.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.base, color: colours.textPrimary, marginBottom: spacing.lg },
  chip:          { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colours.border, backgroundColor: colours.surfaceCard },
  chipActive:    { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  chipText:      { fontSize: typography.fontSize.sm, color: colours.textSecondary },
  chipTextActive:{ color: colours.primary, fontFamily: typography.fontFamily.semiBold },
  sendBtn:       { backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  sendText:      { color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold },
  cancelBtn:     { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText:    { fontSize: typography.fontSize.base, color: colours.textSecondary },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilyGroupChatScreen() {
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
            <Text style={sep.label}>{formatDateLabel(item.createdAt)}</Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <View style={s.groupAvatarCircle}>
            <Ionicons name="people" size={18} color="#fff" />
          </View>
          <View>
            <Text style={s.groupName}>{groupName}</Text>
            <Text style={s.memberCount}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => setShowInvite(true)}
            testID="invite-btn"
            accessibilityLabel="Invite family member"
          >
            <Ionicons name="person-add-outline" size={22} color={colours.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={handleLeave}
            testID="leave-btn"
            accessibilityLabel="Leave group"
          >
            <Ionicons name="exit-outline" size={22} color={colours.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Family group notice banner */}
      <View style={s.noticeBanner}>
        <Ionicons name="information-circle-outline" size={14} color={colours.primary} style={{ marginRight: 4 }} />
        <Text style={s.noticeText}>Family group · Only members you invite can see this chat</Text>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={s.loadingState}>
          <ActivityIndicator size="large" color={colours.primary} />
        </View>
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
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator size="small" color={colours.primary} style={{ marginVertical: spacing.md }} /> : null}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colours.textMuted} />
              <Text style={s.emptyTitle}>Start the Conversation</Text>
              <Text style={s.emptyHint}>Share updates with your family about this match</Text>
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
          placeholderTextColor={colours.textMuted}
          multiline
          maxLength={2000}
          testID="message-input"
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
          testID="send-btn"
          accessibilityLabel="Send message"
        >
          <Ionicons name="send" size={20} color={text.trim() ? '#fff' : colours.textMuted} />
        </TouchableOpacity>
      </View>

      <InviteModal visible={showInvite} groupId={groupId} onClose={() => setShowInvite(false)} />
    </KeyboardAvoidingView>
  );
}

const sep = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: spacing.md },
  label:     { fontSize: typography.fontSize.xs, color: colours.textMuted, backgroundColor: colours.surfaceCard, paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: borderRadius.full },
});

const s = StyleSheet.create({
  wrapper:          { flex: 1, backgroundColor: colours.background },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colours.background, borderBottomWidth: 1, borderBottomColor: colours.border },
  backBtn:          { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerInfo:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupAvatarCircle:{ width: 36, height: 36, borderRadius: 18, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center' },
  groupName:        { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  memberCount:      { fontSize: typography.fontSize.xs, color: colours.textSecondary },
  headerActions:    { flexDirection: 'row', gap: 4 },
  headerBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  noticeBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.primaryLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  noticeText:       { fontSize: typography.fontSize.xs, color: colours.primary },
  loadingState:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent:      { paddingVertical: spacing.md },
  emptyState:       { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: 80, transform: [{ scaleY: -1 }] },
  emptyTitle:       { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semiBold, color: colours.textSecondary },
  emptyHint:        { fontSize: typography.fontSize.sm, color: colours.textMuted, textAlign: 'center' },
  inputBar:         { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, borderTopWidth: 1, borderTopColor: colours.border, backgroundColor: colours.background, gap: spacing.sm },
  input:            { flex: 1, borderWidth: 1, borderColor: colours.border, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 120, fontSize: typography.fontSize.base, color: colours.textPrimary, backgroundColor: colours.surfaceCard },
  sendBtn:          { width: 42, height: 42, borderRadius: 21, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:  { backgroundColor: colours.surfaceCard },
});
