const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, editMessage, deleteMessage } = require('../controllers/chatController');
const { auth, requirePremium } = require('../middlewares/auth');

// All chat routes require premium subscription
router.get('/conversations', auth, requirePremium, getConversations);
router.get('/messages/:userId', auth, requirePremium, getMessages);
router.post('/messages', auth, requirePremium, sendMessage);
router.post('/send', auth, requirePremium, sendMessage); // Alias for frontend compatibility
router.put('/messages/:messageId', auth, requirePremium, editMessage);
router.delete('/messages/:messageId', auth, requirePremium, deleteMessage);

module.exports = router;

