const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage } = require('../controllers/chatController');
const { auth } = require('../middlewares/auth');

router.get('/conversations', auth, getConversations);
router.get('/messages/:userId', auth, getMessages);
router.post('/messages', auth, sendMessage);
router.post('/send', auth, sendMessage); // Alias for frontend compatibility

module.exports = router;

