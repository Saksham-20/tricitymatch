import type { ProfileSummary } from './profile';

// D2: rich message fields are additive — legacy rows read as messageType
// 'text' with null media/reply/reactions fields.
export type MessageType = 'text' | 'voice';

/** `{ "❤️": [userId, …] }` — allowlist in constants/chat.ts. */
export type MessageReactions = Record<string, string[]>;

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: MessageType;
  mediaUrl: string | null;
  mediaDurationMs: number | null;
  replyToId: string | null;
  reactions: MessageReactions;
  isRead: boolean;
  /** Server-included quote of the replied-to message (null once deleted). */
  ReplyTo?: Pick<Message, 'id' | 'content' | 'messageType' | 'senderId'> | null;
  deliveredAt: string | null;
  readAt: string | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * D1 free-reply window state for one (premium, free) pair. Grant = READ
 * forever; SEND only while `active`. `expiresAt` is null until the first
 * reply starts the clock.
 */
export interface ReplyWindow {
  messagesUsed: number;
  messagesRemaining: number;
  firstReplyAt: string | null;
  expiresAt: string | null;
  active: boolean;
}

export type ChatAccessReason =
  | 'paid'
  | 'free_chat_flag'
  | 'free_chat_mutual'
  | 'free_reply_window';

export interface ChatAccess {
  reason: ChatAccessReason;
  replyWindow: ReplyWindow | null;
}

export interface Conversation {
  userId: string;
  profile: ProfileSummary;
  lastMessage: Message | null;
  unreadCount: number;
  isOnline: boolean;
  lastActive: string | null;
  /** D1: non-null only when this thread runs on a free-reply grant (ES5). */
  replyWindow: ReplyWindow | null;
}

export interface SendMessagePayload {
  receiverId: string;
  content: string;
  /** D2, premium-only: quote-reply target (must belong to the pair). */
  replyToId?: string;
}
