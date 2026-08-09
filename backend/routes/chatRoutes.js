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
  editMessage, 
  deleteMessage 
} = require('../controllers/chatController');
const { auth, requireChatAccess, verifyTargetUser } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { messageLimiter } = require('../middlewares/security');
const { 
  sendMessageValidation, 
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
