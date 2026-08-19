/**
 * Chat constants (D1 free-reply window + D2 rich messages).
 * Hand-mirrored with backend/constants/chat.js — same contract as plans.ts.
 */

// D1 — free-reply window (owner decision 2026-08-19: 48 hours / 5 messages).
export const FREE_REPLY_MAX_MESSAGES = 5;
export const FREE_REPLY_WINDOW_MS = 48 * 60 * 60 * 1000;

// D2 — reaction allowlist. Server 400s anything else.
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🙏'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// D2 — voice notes.
export const VOICE_MESSAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VOICE_MESSAGE_MAX_DURATION_MS = 60 * 1000;
