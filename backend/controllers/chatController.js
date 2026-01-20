const { Message, User, Profile, Subscription, Match } = require('../models');
const { Op } = require('sequelize');
const { sendMessageNotification } = require('../utils/emailService');

// Message constraints
const MAX_MESSAGE_LENGTH = 2000;

// Sanitize message content to prevent XSS
const sanitizeMessage = (content) => {
  if (typeof content !== 'string') return '';
  
  return content
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape special HTML characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove null bytes and control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Trim whitespace
    .trim();
};

// @route   GET /api/chat/conversations
// @desc    Get all conversations for current user
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check subscription for chat access
    const subscription = await Subscription.findOne({
      where: {
        userId,
        status: 'active',
        planType: { [Op.in]: ['premium', 'elite'] }
      }
    });

    if (!subscription) {
      return res.status(403).json({ 
        message: 'Premium subscription required to access chat' 
      });
    }

    // Get all unique conversations
    const sentMessages = await Message.findAll({
      where: { senderId: userId },
      attributes: ['receiverId'],
      group: ['receiverId']
    });

    const receivedMessages = await Message.findAll({
      where: { receiverId: userId },
      attributes: ['senderId'],
      group: ['senderId']
    });

    const conversationUserIds = [
      ...new Set([
        ...sentMessages.map(m => m.receiverId),
        ...receivedMessages.map(m => m.senderId)
      ])
    ];

    // Get last message for each conversation
    const conversations = await Promise.all(
      conversationUserIds.map(async (otherUserId) => {
        // Check if it's a mutual match
        const match = await Match.findOne({
          where: {
            [Op.or]: [
              { userId, matchedUserId: otherUserId, isMutual: true },
              { userId: otherUserId, matchedUserId: userId, isMutual: true }
            ]
          }
        });

        if (!match) return null;

        const lastMessage = await Message.findOne({
          where: {
            [Op.or]: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId }
            ]
          },
          order: [['createdAt', 'DESC']],
          include: [
            {
              model: User,
              as: 'Sender',
              attributes: ['id'],
              include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }]
            }
          ]
        });

        const otherUser = await User.findByPk(otherUserId, {
          include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }]
        });

        return {
          userId: otherUserId,
          user: {
            id: otherUser.id,
            name: `${otherUser.Profile.firstName} ${otherUser.Profile.lastName}`,
            profilePhoto: otherUser.Profile.profilePhoto
          },
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            isRead: lastMessage.receiverId === userId ? lastMessage.isRead : true
          } : null,
          unreadCount: await Message.count({
            where: {
              senderId: otherUserId,
              receiverId: userId,
              isRead: false
            }
          })
        };
      })
    );

    const validConversations = conversations.filter(c => c !== null);

    res.json({
      success: true,
      conversations: validConversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/chat/messages/:userId
// @desc    Get messages with a specific user
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user.id;

    // Check subscription
    const subscription = await Subscription.findOne({
      where: {
        userId: currentUserId,
        status: 'active',
        planType: { [Op.in]: ['premium', 'elite'] }
      }
    });

    if (!subscription) {
      return res.status(403).json({ 
        message: 'Premium subscription required to access chat' 
      });
    }

    // Check if it's a mutual match
    const match = await Match.findOne({
      where: {
        [Op.or]: [
          { userId: currentUserId, matchedUserId: otherUserId, isMutual: true },
          { userId: otherUserId, matchedUserId: currentUserId, isMutual: true }
        ]
      }
    });

    if (!match) {
      return res.status(403).json({ 
        message: 'You can only chat with mutual matches' 
      });
    }

    // Get messages
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId }
        ]
      },
      include: [
        {
          model: User,
          as: 'Sender',
          attributes: ['id'],
          include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }]
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    // Mark messages as read
    await Message.update(
      { isRead: true, readAt: new Date() },
      {
        where: {
          senderId: otherUserId,
          receiverId: currentUserId,
          isRead: false
        }
      }
    );

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/chat/messages
// @desc    Send a message
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver ID and content are required' });
    }

    // Sanitize and validate message content
    const sanitizedContent = sanitizeMessage(content);
    
    if (!sanitizedContent) {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }
    
    if (sanitizedContent.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ 
        message: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` 
      });
    }

    // Check subscription
    const subscription = await Subscription.findOne({
      where: {
        userId: senderId,
        status: 'active',
        planType: { [Op.in]: ['premium', 'elite'] }
      }
    });

    if (!subscription) {
      return res.status(403).json({ 
        message: 'Premium subscription required to send messages' 
      });
    }

    // Check if it's a mutual match
    const match = await Match.findOne({
      where: {
        [Op.or]: [
          { userId: senderId, matchedUserId: receiverId, isMutual: true },
          { userId: receiverId, matchedUserId: senderId, isMutual: true }
        ]
      }
    });

    if (!match) {
      return res.status(403).json({ 
        message: 'You can only message mutual matches' 
      });
    }

    // Create message with sanitized content
    const message = await Message.create({
      senderId,
      receiverId,
      content: sanitizedContent
    });

    // Populate sender info
    const messageWithSender = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'Sender',
          attributes: ['id'],
          include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }]
        }
      ]
    });

    // Send email notification
    const receiver = await User.findByPk(receiverId, {
      include: [{ model: Profile }]
    });

    if (receiver) {
      const senderProfile = await Profile.findOne({ where: { userId: senderId } });
      await sendMessageNotification(
        receiver.email,
        `${senderProfile.firstName} ${senderProfile.lastName}`,
        sanitizedContent.substring(0, 100)
      );
    }

    res.json({
      success: true,
      message: messageWithSender
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

