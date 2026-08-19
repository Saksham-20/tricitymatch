import { apiClient } from './client';
import { toProfileSummary } from './profileSummary';
import type { Conversation, Message, ProfileSummary } from '../types';
import type { ChatAccess, ReplyWindow } from '@shared/types/chat';

// ─── Family group chat types ──────────────────────────────────────────────────
export interface FamilyGroup {
  id: string;
  name: string;
  candidateId: string;
  members: FamilyGroupMember[];
  createdAt: string;
}

export interface FamilyGroupMember {
  userId: string;
  name: string;
  relation: string;
  joinedAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

// The backend returns each conversation as { userId, user: { id, name,
// profilePhoto }, lastMessage, unreadCount }. Screens consume the shared
// Conversation shape (profile: ProfileSummary), so map it here.
interface RawConversation {
  userId: string;
  user: { id: string; name: string; profilePhoto: string | null };
  lastMessage: { content: string; createdAt: string; isRead: boolean } | null;
  unreadCount: number;
  /** D1 (additive): reply-window state when this thread runs on a free-reply grant. */
  replyWindow?: import('@shared/types/chat').ReplyWindow | null;
}


/**
 * The conversations endpoint returns only a three-field preview of the last
 * message (content / createdAt / isRead), but `Conversation.lastMessage` is typed
 * as a full `Message`. This used to be bridged with `as unknown as Message`,
 * which hid the fact that id, senderId, deliveredAt, readAt and the edit fields
 * simply are not there.
 *
 * The list UI only renders content, timestamp and read state. Filling the rest
 * with explicit empty values keeps that honest and visible: if a screen ever
 * starts reading `lastMessage.senderId`, it gets an empty string it can check,
 * not an `undefined` that throws — and the gap is documented here rather than
 * silenced at the call site.
 */
const toMessagePreview = (
  conversationUserId: string,
  preview: { content: string; createdAt: string; isRead: boolean },
): Message => ({
  id: '',
  senderId: '',
  receiverId: conversationUserId,
  content: preview.content,
  messageType: 'text',
  mediaUrl: null,
  mediaDurationMs: null,
  replyToId: null,
  reactions: {},
  isRead: preview.isRead,
  deliveredAt: null,
  readAt: null,
  isEdited: false,
  editedAt: null,
  createdAt: preview.createdAt,
  updatedAt: preview.createdAt,
});

export const getConversations = async (): Promise<Conversation[]> => {
  const res = await apiClient.get<{ conversations: RawConversation[] }>('/chat/conversations');
  return (res.data.conversations ?? []).map((c) => {
    const parts = (c.user?.name ?? '').trim().split(' ');
    const profile = toProfileSummary({
      id: c.user?.id ?? c.userId,
      userId: c.userId,
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      profilePhoto: c.user?.profilePhoto ?? null,
      isVerified: false,
    });
    return {
      userId: c.userId,
      profile,
      lastMessage: c.lastMessage ? toMessagePreview(c.userId, c.lastMessage) : null,
      unreadCount: c.unreadCount ?? 0,
      isOnline: false,
      lastActive: null,
      // D1: non-null only when this thread runs on a free-reply grant (ES5)
      replyWindow: c.replyWindow ?? null,
    };
  });
};

export const getThread = async (userId: string, cursor?: string): Promise<{
  messages: Message[];
  nextCursor: string | null;
  /** D1 (additive): {reason, replyWindow} — drives the composer state machine. */
  chatAccess: ChatAccess | null;
}> => {
  const page = cursor ? Number(cursor) : 1;
  const res = await apiClient.get<{ messages: Message[]; pagination: { page: number; pages: number }; chatAccess?: ChatAccess }>(
    `/chat/messages/${userId}`,
    { params: { page, limit: 30 } }
  );
  const { page: cur, pages } = res.data.pagination ?? { page: 1, pages: 1 };
  // Backend returns messages oldest-first (chronological — correct for web's normal
  // scroll). The RN thread renders an inverted FlatList and prepends optimistic sends
  // at index 0, so it needs newest-first; reverse here.
  const messages = (res.data.messages ?? []).slice().reverse();
  return { messages, nextCursor: cur < pages ? String(cur + 1) : null, chatAccess: res.data.chatAccess ?? null };
};

export const sendMessage = async (
  receiverId: string,
  content: string,
  replyToId?: string,
): Promise<{ message: Message; replyWindow: ReplyWindow | null }> => {
  const res = await apiClient.post<{ message: Message; replyWindow?: ReplyWindow }>('/chat/send', {
    receiverId,
    content,
    ...(replyToId ? { replyToId } : {}),
  });
  return { message: res.data.message, replyWindow: res.data.replyWindow ?? null };
};

// D2: voice note — multipart to the dedicated premium route. `uri` is the
// local recording file (expo-av); RN FormData takes {uri, name, type}.
export const sendVoiceMessage = async (
  receiverId: string,
  uri: string,
  durationMs: number,
): Promise<Message> => {
  const form = new FormData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form.append('audio', { uri, name: 'voice-message.m4a', type: 'audio/mp4' } as any);
  form.append('receiverId', receiverId);
  form.append('durationMs', String(Math.round(durationMs)));
  const res = await apiClient.post<{ message: Message }>('/chat/messages/voice', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.message;
};

// D2: toggle an emoji reaction (premium; 6-emoji allowlist server-enforced).
export const toggleReaction = async (
  messageId: string,
  emoji: string,
): Promise<Record<string, string[]>> => {
  const res = await apiClient.post<{ reactions: Record<string, string[]> }>(
    `/chat/messages/${messageId}/reactions`,
    { emoji },
  );
  return res.data.reactions;
};

export const editMessage = async (messageId: string, content: string): Promise<Message> => {
  const res = await apiClient.put<{ message: Message }>(`/chat/messages/${messageId}`, { content });
  return res.data.message;
};

export const deleteMessage = async (messageId: string, forBoth: boolean): Promise<void> => {
  await apiClient.delete(`/chat/messages/${messageId}`, { params: { forBoth } });
};

// ─── Family group chat APIs ───────────────────────────────────────────────────
// Backed by the REST `/groups` endpoints. Responses follow the app's
// { success, ... } envelope, so we unwrap + map to the screen-facing types here.

interface RawGroup {
  id: string;
  name: string;
  candidateUserId: string | null;
  memberCount?: number;
  createdAt: string;
  Members?: Array<{ id: string; userId: string; role: string; User?: { id: string; Profile?: { firstName?: string; lastName?: string } } }>;
}

const mapGroup = (g: RawGroup): FamilyGroup => ({
  id: g.id,
  name: g.name,
  candidateId: g.candidateUserId ?? '',
  createdAt: g.createdAt,
  members: (g.Members ?? []).map((m) => ({
    userId: m.userId,
    name: m.User?.Profile ? [m.User.Profile.firstName, m.User.Profile.lastName].filter(Boolean).join(' ') : '',
    relation: m.role,
    joinedAt: g.createdAt,
  })),
  // List endpoint returns memberCount without the full Members array — synthesize
  // a placeholder array of that length so screens can read `.members.length`.
  ...(g.Members === undefined && typeof g.memberCount === 'number'
    ? { members: Array.from({ length: g.memberCount }, () => ({ userId: '', name: '', relation: 'member', joinedAt: g.createdAt })) }
    : {}),
});

export const getFamilyGroups = async (): Promise<FamilyGroup[]> => {
  const res = await apiClient.get<{ groups: RawGroup[] }>('/groups');
  return (res.data.groups ?? []).map(mapGroup);
};

export const createFamilyGroup = async (name: string): Promise<FamilyGroup> => {
  const res = await apiClient.post<{ group: RawGroup }>('/groups', { name });
  return mapGroup(res.data.group);
};

export const inviteToFamilyGroup = async (groupId: string, phone: string, relation: string): Promise<void> => {
  // relation is informational only; membership is tracked by role on the backend.
  await apiClient.post(`/groups/${groupId}/invite`, { phone, relation });
};

export const leaveFamilyGroup = async (groupId: string): Promise<void> => {
  await apiClient.delete(`/groups/${groupId}/leave`);
};

export const getGroupThread = async (groupId: string, cursor?: string): Promise<{
  messages: GroupMessage[];
  nextCursor: string | null;
}> => {
  const page = cursor ? Number(cursor) : 1;
  const res = await apiClient.get<{ messages: GroupMessage[]; nextCursor: string | null }>(
    `/groups/${groupId}/messages`,
    { params: { page, limit: 30 } }
  );
  return { messages: res.data.messages ?? [], nextCursor: res.data.nextCursor ?? null };
};

export const sendGroupMessage = async (groupId: string, content: string): Promise<GroupMessage> => {
  const res = await apiClient.post<{ message: GroupMessage }>(`/groups/${groupId}/messages`, { content });
  return res.data.message;
};
