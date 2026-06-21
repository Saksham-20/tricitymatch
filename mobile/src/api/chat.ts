import { apiClient } from './client';
import type { Conversation, Message, ProfileSummary } from '../types';

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
}

export const getConversations = async (): Promise<Conversation[]> => {
  const res = await apiClient.get<{ conversations: RawConversation[] }>('/chat/conversations');
  return (res.data.conversations ?? []).map((c) => {
    const parts = (c.user?.name ?? '').trim().split(' ');
    const profile = {
      id: c.user?.id ?? c.userId,
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      profilePhoto: c.user?.profilePhoto ?? null,
      isVerified: false,
    } as unknown as ProfileSummary;
    return {
      userId: c.userId,
      profile,
      lastMessage: c.lastMessage
        ? ({
            content: c.lastMessage.content,
            createdAt: c.lastMessage.createdAt,
            isRead: c.lastMessage.isRead,
          } as unknown as Message)
        : null,
      unreadCount: c.unreadCount ?? 0,
      isOnline: false,
      lastActive: null,
    };
  });
};

export const getThread = async (userId: string, cursor?: string): Promise<{
  messages: Message[];
  nextCursor: string | null;
}> => {
  const page = cursor ? Number(cursor) : 1;
  const res = await apiClient.get<{ messages: Message[]; pagination: { page: number; pages: number } }>(
    `/chat/messages/${userId}`,
    { params: { page, limit: 30 } }
  );
  const { page: cur, pages } = res.data.pagination ?? { page: 1, pages: 1 };
  return { messages: res.data.messages ?? [], nextCursor: cur < pages ? String(cur + 1) : null };
};

export const sendMessage = async (receiverId: string, content: string): Promise<Message> => {
  const res = await apiClient.post<{ message: Message }>('/chat/send', { receiverId, content });
  return res.data.message;
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
