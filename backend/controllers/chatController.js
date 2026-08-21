/**
 * Chat Controller
 * Handles messaging between matched users with proper security
 */

const { Message, User, Profile, Match, ChatGrant } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { sendMessageNotification } = require('../utils/emailService');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');
const { getActiveSubscription, grantWindowState } = require('../utils/entitlements');
const { REACTION_EMOJIS, VOICE_MESSAGE_MAX_DURATION_MS } = require('../constants/chat');

// D2: the standard include for returning a message to clients — sender card
// plus a minimal quote of the replied-to message (null once that message is
// deleted; the FK is ON DELETE SET NULL).
const MESSAGE_INCLUDE = [
  {
    model: User,
    as: 'Sender',
    attributes: ['id'],
    include: [{
      model: Profile,
      attributes: ['firstName', 'lastName', 'profilePhoto']
    }]
  },
  {
    model: Message,
    as: 'ReplyTo',
    attributes: ['id', 'content', 'messageType', 'senderId']
  }
];

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

// Emit a chat event to the pair room and the receiver's personal room.
// ES1 (server-authoritative sockets): REST is the single write path, so REST is
// also the single broadcast path — the legacy client-originated socket relays are
// no-ops. Each broadcast dual-emits the new namespaced event plus the legacy
// event name so shipped mobile/web builds keep receiving in real time. The
// legacy names are frozen for at least one release cycle.
const emitToConversation = (req, senderId, receiverId, events) => {
  const io = req.app.get('io');
  if (!io) return;
  const roomId = [senderId, receiverId].sort().join('_room_');
  for (const [event, payload] of events) {
    io.to(roomId).emit(event, payload);
    io.to(`user_${receiverId}`).emit(event, payload);
  }
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
  // Clamp, do not trust the validator alone -- searchController.js already does
  // this and says why. Unclamped, `?limit=100000` flowed straight into
  // Match.findAll and then into the raw DISTINCT ON query's IN (:matchedUserIds),
  // so one authenticated request could pull the caller's entire match graph.
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
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

  // D1: one batched, indexed grant lookup so free members with grants see
  // their reply-window state per row (premium members: empty result, no cost).
  const grantsHeld = config.features.freeReplyWindow
    ? await ChatGrant.findAll({
        where: { freeUserId: userId, premiumUserId: { [Op.in]: matchedUserIds } }
      })
    : [];
  const grantMap = new Map(grantsHeld.map(g => [g.premiumUserId, grantWindowState(g)]));

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
        m."messageType",
        m."createdAt",
        m."isRead"
      FROM "Messages" m
      WHERE (m."senderId" = :userId OR m."receiverId" = :userId)
        AND (m."senderId" IN (:matchedUserIds) OR m."receiverId" IN (:matchedUserIds))
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
      // ES10: a voice message stores '' — surface a readable preview instead
      // of an empty row.
      content: msg.messageType === 'voice' ? 'Voice message' : msg.content,
      messageType: msg.messageType,
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
      unreadCount: unreadCountMap.get(match.matchedUserId) || 0,
      // D1 (additive): non-null only when this thread runs on a free-reply
      // grant. ES5: free clients render threads without a grant AND without
      // flag/paid access as locked rows.
      replyWindow: grantMap.get(match.matchedUserId) || null
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
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  // Cap to 100 messages per page to prevent bulk dumps
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
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
    include: MESSAGE_INCLUDE,
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
    // D1 (additive): lets the client pick the composer state — normal, meter
    // ("N replies left"), or paywalled (window ended). reason 'paid' /
    // 'free_chat_*' means unrestricted; replyWindow only exists for grants.
    chatAccess: {
      reason: req.chatAccess?.reason || req.chatAccessReason || 'paid',
      replyWindow: req.chatAccess?.replyWindow || null
    },
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
  const { receiverId, content, replyToId } = req.body;
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

  const accessReason = req.chatAccess?.reason || req.chatAccessReason;

  // D2 quote-reply is premium-only (canReplyQuote) and the target must belong
  // to this pair — otherwise a message id from any conversation could be
  // quoted into this one.
  if (replyToId) {
    if (accessReason !== 'paid') {
      throw createError.forbidden(
        accessReason === 'free_reply_window'
          ? 'Free replies are text-only'
          : 'Quote replies require a premium plan',
        accessReason === 'free_reply_window' ? 'REPLY_WINDOW_TEXT_ONLY' : 'PREMIUM_REQUIRED'
      );
    }
    const quoted = await Message.findByPk(replyToId, { attributes: ['id', 'senderId', 'receiverId'] });
    const inPair = quoted &&
      [quoted.senderId, quoted.receiverId].includes(senderId) &&
      [quoted.senderId, quoted.receiverId].includes(receiverId);
    if (!inPair) {
      throw createError.badRequest('Quoted message does not belong to this conversation');
    }
  }

  let message;
  let replyWindow;

  if (accessReason === 'free_reply_window') {
    // D1 send enforcement — transactional with a row lock so two concurrent
    // sends at messagesUsed=4 can't both slip through (ES6 race). The state
    // attached at route time is advisory only; the locked row is the truth.
    message = await sequelize.transaction(async (t) => {
      const grant = await ChatGrant.findOne({
        where: { freeUserId: senderId, premiumUserId: receiverId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!grant) {
        throw createError.forbidden('Your reply window has ended', 'REPLY_WINDOW_ENDED');
      }

      const state = grantWindowState(grant);
      if (!state.active) {
        const err = createError.forbidden('Your reply window has ended', 'REPLY_WINDOW_ENDED');
        err.replyWindow = state;
        throw err;
      }

      // The window clock starts at the FIRST reply, not at the grant.
      if (!grant.firstReplyAt) {
        grant.firstReplyAt = new Date();
      }

      const created = await Message.create({
        senderId,
        receiverId,
        content: sanitizedContent
      }, { transaction: t });

      grant.messagesUsed += 1;
      await grant.save({ transaction: t });

      replyWindow = grantWindowState(grant);
      return created;
    });
  } else {
    // Create message
    message = await Message.create({
      senderId,
      receiverId,
      content: sanitizedContent,
      replyToId: replyToId || null
    });

    // D1 grant creation: a PAID member's message to a FREE member opens (or
    // keeps) that member's reply window. findOrCreate + the unique pair index
    // make this idempotent; counters never reset in v1. Skipped when
    // freeChatForMutuals already gives mutuals full chat (grants moot).
    if (
      accessReason === 'paid' &&
      config.features.freeReplyWindow &&
      !config.features.freeChatForMutuals
    ) {
      try {
        const receiverSub = await getActiveSubscription(receiverId);
        if (!receiverSub) {
          await ChatGrant.findOrCreate({
            where: { premiumUserId: senderId, freeUserId: receiverId },
            defaults: { messagesUsed: 0, firstReplyAt: null },
          });
          log.info('Chat grant ensured', { premiumUserId: senderId, freeUserId: receiverId });
        }
      } catch (error) {
        // Grant creation must never fail the send itself.
        log.error('Chat grant creation failed', { senderId, receiverId, error: error.message });
      }
    }
  }

  // Fetch message with sender info
  const messageWithSender = await Message.findByPk(message.id, {
    include: MESSAGE_INCLUDE
  });

  // Broadcast the new message (legacy event name + namespaced; see emitToConversation)
  emitToConversation(req, senderId, receiverId, [
    ['message', messageWithSender],
    ['message:new', { message: messageWithSender }]
  ]);

  // Send email notification (non-blocking). Never pass message content to avoid PII in logs/email previews.
  setImmediate(async () => {
    try {
      const [receiver, senderProfile] = await Promise.all([
        User.findByPk(receiverId, { attributes: ['id', 'email'], include: [{ model: Profile, attributes: ['firstName'] }] }),
        Profile.findOne({ where: { userId: senderId }, attributes: ['firstName', 'lastName'] })
      ]);

      if (receiver?.email && senderProfile) {
        await sendMessageNotification(
          receiver.email,
          `${senderProfile.firstName} ${senderProfile.lastName}`,
          'You have a new message' // no content preview — avoids PII in email logs
        );
      }
    } catch (error) {
      log.error('Failed to send message notification', { error: error.message, receiverId });
    }
  });

  res.json({
    success: true,
    message: messageWithSender,
    // D1: post-increment window state — drives the "N replies left" meter and
    // the first-reply upsell. Absent for paid/flag sends.
    ...(replyWindow ? { replyWindow } : {})
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

  // D2: editing rewrites `content`, which a voice message doesn't have.
  if (message.messageType === 'voice') {
    throw createError.badRequest('Voice messages cannot be edited');
  }

  // Update message
  message.content = sanitizedContent;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  // Return updated message with sender info
  const updatedMessage = await Message.findByPk(messageId, {
    include: MESSAGE_INCLUDE
  });

  // Broadcast the edit authoritatively (ownership + time limit verified above)
  emitToConversation(req, userId, message.receiverId, [
    ['message-edited', { message: updatedMessage }],
    ['message:edited', { message: updatedMessage }]
  ]);

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

  // SOCK-3: emit the deletion authoritatively from the server (ownership already
  // verified above) instead of trusting a client `message-deleted` socket event.
  emitToConversation(req, userId, receiverId, [
    ['message-deleted', { messageId: deletedMessageId }],
    ['message:deleted', { messageId: deletedMessageId }]
  ]);

  res.json({
    success: true,
    deletedMessageId,
    receiverId
  });
});

// @route   POST /api/chat/messages/voice
// @desc    Send a voice message (premium-only; multipart `audio` + receiverId)
// @access  Private/Premium
// ES7: this is a multipart route, so the route gate is paid-only
// (`requirePremium`) — req.body doesn't exist until multer parses. Pair
// membership is verified HERE, after the parse.
exports.sendVoiceMessage = asyncHandler(async (req, res) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;

  if (!req.file) {
    throw createError.badRequest('Audio file is required');
  }
  if (!receiverId) {
    throw createError.badRequest('receiverId is required');
  }

  const durationMs = parseInt(req.body.durationMs, 10);
  if (Number.isFinite(durationMs) && durationMs > VOICE_MESSAGE_MAX_DURATION_MS) {
    throw createError.badRequest('Voice messages are limited to 60 seconds');
  }

  if (receiverId === senderId) {
    throw createError.badRequest('Cannot perform this action on yourself');
  }

  // Mirrors verifyTargetUser (which can't run on a multipart route, ES7).
  const targetUser = await User.findByPk(receiverId, { attributes: ['id', 'status'] });
  if (!targetUser) {
    throw createError.notFound('User not found');
  }
  if (targetUser.status !== 'active') {
    throw createError.badRequest('User is not available');
  }

  const isMutual = await verifyMutualMatch(senderId, receiverId);
  if (!isMutual) {
    throw createError.forbidden('You can only message mutual matches');
  }

  const mediaUrl = req.file.path || `/uploads/${req.file.filename}`;

  const message = await Message.create({
    senderId,
    receiverId,
    content: '',
    messageType: 'voice',
    mediaUrl,
    mediaDurationMs: Number.isFinite(durationMs) ? durationMs : null
  });

  const messageWithSender = await Message.findByPk(message.id, {
    include: MESSAGE_INCLUDE
  });

  emitToConversation(req, senderId, receiverId, [
    ['message', messageWithSender],
    ['message:new', { message: messageWithSender }]
  ]);

  res.json({
    success: true,
    message: messageWithSender
  });
});

// @route   POST /api/chat/messages/:messageId/reactions
// @desc    Toggle an emoji reaction (premium-only; sender or receiver)
// @access  Private/Premium
exports.toggleReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user.id;

  if (!REACTION_EMOJIS.includes(emoji)) {
    throw createError.badRequest('Unsupported reaction');
  }

  // ES3: reactions are a JSONB read-modify-write — two concurrent toggles
  // without the row lock would lose one. Same lock pattern as the grant send.
  const message = await sequelize.transaction(async (t) => {
    const row = await Message.findByPk(messageId, {
      lock: t.LOCK.UPDATE,
      transaction: t
    });

    if (!row) {
      throw createError.notFound('Message not found');
    }
    if (row.senderId !== userId && row.receiverId !== userId) {
      throw createError.forbidden('You can only react in your own conversations');
    }

    const reactions = { ...(row.reactions || {}) };
    const users = new Set(reactions[emoji] || []);
    if (users.has(userId)) {
      users.delete(userId);
    } else {
      users.add(userId);
    }
    if (users.size > 0) {
      reactions[emoji] = [...users];
    } else {
      delete reactions[emoji];
    }

    row.reactions = reactions;
    row.changed('reactions', true);
    await row.save({ transaction: t });
    return row;
  });

  const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;

  // New namespaced event only — legacy clients have no reactions UI.
  emitToConversation(req, userId, otherUserId, [
    ['message:reaction', { messageId: message.id, reactions: message.reactions }]
  ]);

  res.json({
    success: true,
    messageId: message.id,
    reactions: message.reactions
  });
});
