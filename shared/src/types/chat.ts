import type { ProfileSummary } from './profile';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  deliveredAt: string | null;
  readAt: string | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  userId: string;
  profile: ProfileSummary;
  lastMessage: Message | null;
  unreadCount: number;
  isOnline: boolean;
  lastActive: string | null;
}

export interface SendMessagePayload {
  receiverId: string;
  content: string;
}
