/**
 * Chat Routes
 * Real-time messaging endpoints with validation and rate limiting
 */

const express = require('express');
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage,
  sendVoiceMessage,
  toggleReaction,
  editMessage,
  deleteMessage
} = require('../controllers/chatController');
const { auth, requireChatAccess, requirePremium, verifyTargetUser } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { messageLimiter, uploadLimiter } = require('../middlewares/security');
const { uploadVoiceMessage } = require('../middlewares/upload');
const {
  sendMessageValidation,
  reactionValidation,
  editMessageValidation,
  deleteMessageValidation,
  getMessagesValidation,
  paginationRules
} = require('../validators');

// All chat routes require authentication and chat access. `requireChatAccess`
// is premium-only by default and additionally admits mutual matches when
// FREE_CHAT_FOR_MUTUALS is on — it is the ONLY gate that reads that flag, so
// every other premium perk stays behind `requirePremium`.
router.use(auth, requireChatAccess);

// Get all conversations with pagination
router.get('/conversations', 
  paginationRules,
  handleValidationErrors,
  getConversations
);

// Get messages with a specific user
router.get('/messages/:userId', 
  getMessagesValidation,
  handleValidationErrors,
  getMessages
);

// Send a message (rate limited)
router.post('/messages', 
  messageLimiter,
  sendMessageValidation,
  handleValidationErrors,
  verifyTargetUser('receiverId'),
  sendMessage
);

// Alias for frontend compatibility
router.post('/send', 
  messageLimiter,
  sendMessageValidation,
  handleValidationErrors,
  verifyTargetUser('receiverId'),
  sendMessage
);

// D2: send a voice message (premium-only; multipart, so no requireChatAccess
// body read and no verifyTargetUser here — multer parses the body AFTER route
// middleware (ES7). Pair membership + receiver checks run in the controller.
// Rides uploadLimiter (20/hr), not messageLimiter (ES11).
router.post('/messages/voice',
  requirePremium,
  uploadLimiter,
  uploadVoiceMessage,
  sendVoiceMessage
);

// D2: toggle an emoji reaction (premium-only, sender-or-receiver of the message)
router.post('/messages/:messageId/reactions',
  requirePremium,
  messageLimiter,
  reactionValidation,
  handleValidationErrors,
  toggleReaction
);

// Edit a message
router.put('/messages/:messageId',
  editMessageValidation,
  handleValidationErrors,
  editMessage
);

// Delete a message
router.delete('/messages/:messageId', 
  deleteMessageValidation,
  handleValidationErrors,
  deleteMessage
);

module.exports = router;
