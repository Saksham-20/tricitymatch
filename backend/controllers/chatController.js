/**
 * Chat Controller
 * Handles messaging between matched users with proper security
 */

const { Message, User, Profile, Match } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { sendMessageNotification } = require('../utils/emailService');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');

// Message constraints from config
const MAX_MESSAGE_LENGTH = config.chat.maxMessageLength;
const MESSAGE_EDIT_TIME_LIMIT = config.chat.messageEditTimeLimit * 60 * 1000;

// Sanitize message content to prevent XSS
const sanitizeMessage = (content) => {
  if (typeof content !== 'string') return '';

  return content
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
};

// Verify mutual match between two users
const verifyMutualMatch = async (userId1, userId2, transaction = null) => {
  const options = transaction ? { transaction } : {};
  
  const match = await Match.findOne({
    where: {
      [Op.or]: [
        { userId: userId1, matchedUserId: userId2, isMutual: true },
        { userId: userId2, matchedUserId: userId1, isMutual: true }
      ]
    },
    ...options
  });

  return !!match;
};

// @route   GET /api/chat/conversations
// @desc    Get all conversations for current user (optimized)
// @access  Private/Premium
exports.getConversations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  // Get mutual matches (only mutual matches can have conversations)
  const mutualMatches = await Match.findAll({
    where: {
      userId,
      isMutual: true
    },
    attributes: ['matchedUserId'],
    include: [{
      model: User,
      as: 'MatchedUser',
      attributes: ['id'],
      include: [{
        model: Profile,
        attributes: ['firstName', 'lastName', 'profilePhoto'],
        required: true
      }]
    }],
    limit,
    offset
  });

  if (mutualMatches.length === 0) {
    return res.json({
      success: true,
      conversations: [],
      pagination: { page, limit, total: 0, pages: 0 }
    });
  }

  // Get all matched user IDs
  const matchedUserIds = mutualMatches.map(m => m.matchedUserId);

  // Batch query: Get last message and unread count for all conversations in one query
  const [lastMessages, unreadCounts] = await Promise.all([
    // Get last message for each conversation
    sequelize.query(`
      SELECT DISTINCT ON (
        LEAST(m."senderId", m."receiverId"),
        GREATEST(m."senderId", m."receiverId")
      )
        m.id,
        m."senderId",
        m."receiverId",
        m.content,
        m."createdAt",
        m."isRead"
      FROM "Messages" m
      WHERE (m."senderId" = :userId OR m."receiverId" = :userId)
        AND (m."senderId" = ANY(:matchedUserIds) OR m."receiverId" = ANY(:matchedUserIds))
      ORDER BY
        LEAST(m."senderId", m."receiverId"),
        GREATEST(m."senderId", m."receiverId"),
        m."createdAt" DESC
    `, {
      replacements: { userId, matchedUserIds },
      type: sequelize.QueryTypes.SELECT
    }),
    
    // Get unread counts for all conversations
    Message.findAll({
      attributes: [
        'senderId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'unreadCount']
      ],
      where: {
        receiverId: userId,
        senderId: { [Op.in]: matchedUserIds },
        isRead: false
      },
      group: ['senderId'],
      raw: true
    })
  ]);

  // Create lookup maps
  const lastMessageMap = new Map();
  lastMessages.forEach(msg => {
    const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    lastMessageMap.set(otherUserId, {
      content: msg.content,
      createdAt: msg.createdAt,
      isRead: msg.receiverId === userId ? msg.isRead : true
    });
  });

  const unreadCountMap = new Map();
  unreadCounts.forEach(uc => {
    unreadCountMap.set(uc.senderId, parseInt(uc.unreadCount));
  });

  // Build conversations response
  const conversations = mutualMatches
    .filter(match => match.MatchedUser?.Profile)
    .map(match => ({
      userId: match.matchedUserId,
      user: {
        id: match.matchedUserId,
        name: `${match.MatchedUser.Profile.firstName} ${match.MatchedUser.Profile.lastName}`,
        profilePhoto: match.MatchedUser.Profile.profilePhoto
      },
      lastMessage: lastMessageMap.get(match.matchedUserId) || null,
      unreadCount: unreadCountMap.get(match.matchedUserId) || 0
    }))
    .sort((a, b) => {
      // Sort by last message date, most recent first
      const dateA = a.lastMessage?.createdAt || new Date(0);
      const dateB = b.lastMessage?.createdAt || new Date(0);
      return new Date(dateB) - new Date(dateA);
    });

  // Get total count for pagination
  const totalMatches = await Match.count({
    where: { userId, isMutual: true }
  });

  res.json({
    success: true,
    conversations,
    pagination: {
      page,
      limit,
      total: totalMatches,
      pages: Math.ceil(totalMatches / limit)
    }
  });
});

// @route   GET /api/chat/messages/:userId
// @desc    Get messages with a specific user
// @access  Private/Premium
exports.getMessages = asyncHandler(async (req, res) => {
  const { userId: otherUserId } = req.params;
  const currentUserId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  // Verify mutual match
  const isMutual = await verifyMutualMatch(currentUserId, otherUserId);
  if (!isMutual) {
    throw createError.forbidden('You can only chat with mutual matches');
  }

  // Get messages with pagination (newest first, then reverse for display)
  const { count, rows: messages } = await Message.findAndCountAll({
    where: {
      [Op.or]: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    },
    include: [{
      model: User,
      as: 'Sender',
      attributes: ['id'],
      include: [{
        model: Profile,
        attributes: ['firstName', 'lastName', 'profilePhoto']
      }]
    }],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  // Reverse to get chronological order for display
  const sortedMessages = messages.reverse();

  // Mark messages as read (batch update)
  const now = new Date();
  await Message.update(
    { isRead: true, readAt: now, deliveredAt: sequelize.literal('COALESCE("deliveredAt", NOW())') },
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
    messages: sortedMessages,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   POST /api/chat/messages
// @desc    Send a message
// @access  Private/Premium
exports.sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, content } = req.body;
  const senderId = req.user.id;

  // Sanitize content
  const sanitizedContent = sanitizeMessage(content);

  if (!sanitizedContent) {
    throw createError.badRequest('Message content cannot be empty');
  }

  if (sanitizedContent.length > MAX_MESSAGE_LENGTH) {
    throw createError.badRequest(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
  }

  // Verify mutual match
  const isMutual = await verifyMutualMatch(senderId, receiverId);
  if (!isMutual) {
    throw createError.forbidden('You can only message mutual matches');
  }

  // Create message
  const message = await Message.create({
    senderId,
    receiverId,
    content: sanitizedContent
  });

  // Fetch message with sender info
  const messageWithSender = await Message.findByPk(message.id, {
    include: [{
      model: User,
      as: 'Sender',
      attributes: ['id'],
      include: [{
        model: Profile,
        attributes: ['firstName', 'lastName', 'profilePhoto']
      }]
    }]
  });

  // Send email notification (non-blocking)
  setImmediate(async () => {
    try {
      const [receiver, senderProfile] = await Promise.all([
        User.findByPk(receiverId, { include: [{ model: Profile }] }),
        Profile.findOne({ where: { userId: senderId } })
      ]);

      if (receiver && senderProfile) {
        await sendMessageNotification(
          receiver.email,
          `${senderProfile.firstName} ${senderProfile.lastName}`,
          sanitizedContent.substring(0, 100)
        );
      }
    } catch (error) {
      console.error('Failed to send message notification:', error);
    }
  });

  res.json({
    success: true,
    message: messageWithSender
  });
});

// @route   PUT /api/chat/messages/:messageId
// @desc    Edit a message (only sender can edit within time limit)
// @access  Private/Premium
exports.editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  // Sanitize content
  const sanitizedContent = sanitizeMessage(content);

  if (!sanitizedContent) {
    throw createError.badRequest('Message content cannot be empty');
  }

  if (sanitizedContent.length > MAX_MESSAGE_LENGTH) {
    throw createError.badRequest(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
  }

  const message = await Message.findByPk(messageId);

  if (!message) {
    throw createError.notFound('Message not found');
  }

  // Only sender can edit
  if (message.senderId !== userId) {
    throw createError.forbidden('You can only edit your own messages');
  }

  // Check time limit
  const messageAge = Date.now() - new Date(message.createdAt).getTime();
  if (messageAge > MESSAGE_EDIT_TIME_LIMIT) {
    throw createError.forbidden(`Message is too old to edit (${config.chat.messageEditTimeLimit} minute limit)`);
  }

  // Update message
  message.content = sanitizedContent;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  // Return updated message with sender info
  const updatedMessage = await Message.findByPk(messageId, {
    include: [{
      model: User,
      as: 'Sender',
      attributes: ['id'],
      include: [{
        model: Profile,
        attributes: ['firstName', 'lastName', 'profilePhoto']
      }]
    }]
  });

  res.json({
    success: true,
    message: updatedMessage
  });
});

// @route   DELETE /api/chat/messages/:messageId
// @desc    Delete a message (only sender can delete)
// @access  Private/Premium
exports.deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const message = await Message.findByPk(messageId);

  if (!message) {
    throw createError.notFound('Message not found');
  }

  // Only sender can delete
  if (message.senderId !== userId) {
    throw createError.forbidden('You can only delete your own messages');
  }

  const deletedMessageId = message.id;
  const receiverId = message.receiverId;

  await message.destroy();

  res.json({
    success: true,
    deletedMessageId,
    receiverId
  });
});
