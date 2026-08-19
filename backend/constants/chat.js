'use strict';

/**
 * Chat constants (D1 free-reply window + D2 rich messages).
 * Mirrored in shared/src/constants/chat.ts for the web + RN clients — keep the
 * two files in sync by hand (same contract as constants/plans.js).
 */

// D1 — free-reply window (owner decision 2026-08-19: 48 hours / 5 messages).
// A free member who receives a first message from a premium member may reply
// up to FREE_REPLY_MAX_MESSAGES times within FREE_REPLY_WINDOW_MS of their
// FIRST reply. Text only — reactions/voice/reply-quote stay premium.
const FREE_REPLY_MAX_MESSAGES = 5;
const FREE_REPLY_WINDOW_MS = 48 * 60 * 60 * 1000;

// D2 — reaction allowlist. The server 400s anything else; changing the set is
// a constants-only edit (both files).
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];

// D2 — voice notes.
const VOICE_MESSAGE_MAX_BYTES = 5 * 1024 * 1024;
const VOICE_MESSAGE_MAX_DURATION_MS = 60 * 1000;

module.exports = {
  FREE_REPLY_MAX_MESSAGES,
  FREE_REPLY_WINDOW_MS,
  REACTION_EMOJIS,
  VOICE_MESSAGE_MAX_BYTES,
  VOICE_MESSAGE_MAX_DURATION_MS,
};
