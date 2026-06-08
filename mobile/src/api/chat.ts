import { apiClient } from './client';
import type { Conversation, Message } from '../types';

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

export const getConversations = async (): Promise<Conversation[]> => {
  const res = await apiClient.get<Conversation[]>('/chat/conversations');
  return res.data;
};

export const getThread = async (userId: string, cursor?: string): Promise<{
  messages: Message[];
  nextCursor: string | null;
}> => {
  const res = await apiClient.get(`/chat/${userId}`, { params: { cursor, limit: 30 } });
  return res.data;
};

export const sendMessage = async (receiverId: string, content: string): Promise<Message> => {
  const res = await apiClient.post<Message>('/chat/send', { receiverId, content });
  return res.data;
};

export const editMessage = async (messageId: string, content: string): Promise<Message> => {
  const res = await apiClient.put<Message>(`/chat/message/${messageId}`, { content });
  return res.data;
};

export const deleteMessage = async (messageId: string, forBoth: boolean): Promise<void> => {
  await apiClient.delete(`/chat/message/${messageId}`, { params: { forBoth } });
};

// ─── Family group chat APIs ───────────────────────────────────────────────────

export const getFamilyGroups = async (): Promise<FamilyGroup[]> => {
  const res = await apiClient.get<FamilyGroup[]>('/chat/family-groups');
  return res.data;
};

export const createFamilyGroup = async (name: string): Promise<FamilyGroup> => {
  const res = await apiClient.post<FamilyGroup>('/chat/family-groups', { name });
  return res.data;
};

export const inviteToFamilyGroup = async (groupId: string, phone: string, relation: string): Promise<void> => {
  await apiClient.post(`/chat/family-groups/${groupId}/invite`, { phone, relation });
};

export const leaveFamilyGroup = async (groupId: string): Promise<void> => {
  await apiClient.delete(`/chat/family-groups/${groupId}/leave`);
};

export const getGroupThread = async (groupId: string, cursor?: string): Promise<{
  messages: GroupMessage[];
  nextCursor: string | null;
}> => {
  const res = await apiClient.get(`/chat/family-groups/${groupId}/messages`, { params: { cursor, limit: 30 } });
  return res.data;
};

export const sendGroupMessage = async (groupId: string, content: string): Promise<GroupMessage> => {
  const res = await apiClient.post<GroupMessage>(`/chat/family-groups/${groupId}/messages`, { content });
  return res.data;
};
