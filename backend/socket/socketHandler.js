/**
 * Socket.io Handler
 * Real-time communication with proper security
 */

const { Message, Match, Subscription } = require('../models');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const config = require('../config/env');
const { log, logSecurityEvent } = require('../middlewares/logger');

// Socket rate limiting map
const socketRateLimits = new Map();

// Rate limit config per event type
const RATE_LIMITS = {
  'send-message': { maxRequests: 30, windowMs: 60000 }, // 30 messages/minute
  'typing': { maxRequests: 60, windowMs: 60000 }, // 60 typing events/minute
  'join-room': { maxRequests: 20, windowMs: 60000 }, // 20 room joins/minute
  'get-online-status': { maxRequests: 30, windowMs: 60000 }, // 30 status checks/minute
};

// Check socket rate limit
const checkRateLimit = (socketId, eventName) => {
  const limit = RATE_LIMITS[eventName];
  if (!limit) return true; // No limit defined

  const key = `${socketId}:${eventName}`;
  const now = Date.now();
  
  if (!socketRateLimits.has(key)) {
    socketRateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }

  const record = socketRateLimits.get(key);
  
  // Reset window if expired
  if (now - record.windowStart > limit.windowMs) {
    socketRateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }

  // Check if over limit
  if (record.count >= limit.maxRequests) {
    return false;
  }

  record.count++;
  return true;
};

// Clean up rate limit records periodically
const cleanupRateLimits = () => {
  const now = Date.now();
  for (const [key, record] of socketRateLimits.entries()) {
    // Remove records older than 2 minutes
    if (now - record.windowStart > 120000) {
      socketRateLimits.delete(key);
    }
  }
};

// Extract token from various sources (cookies, auth object, headers)
const extractToken = (socket) => {
  // 1. Try httpOnly cookie first (most secure)
  if (socket.handshake.headers.cookie) {
    const cookies = cookie.parse(socket.handshake.headers.cookie);
    if (cookies.accessToken) {
      return cookies.accessToken;
    }
  }

  // 2. Try auth object (for backwards compatibility)
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  // 3. Try authorization header
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  return null;
};

// Verify JWT token for socket authentication
const authenticateSocket = async (socket, next) => {
  try {
    const token = extractToken(socket);

    if (!token) {
      logSecurityEvent('socket_auth_failed', null, { reason: 'no_token', socketId: socket.id });
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, config.auth.jwtSecret);

    if (decoded.type !== 'access') {
      logSecurityEvent('socket_auth_failed', null, { reason: 'invalid_token_type', socketId: socket.id });
      return next(new Error('Invalid token type'));
    }

    socket.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    logSecurityEvent('socket_auth_failed', null, { reason: error.message, socketId: socket.id });
    return next(new Error('Invalid token'));
  }
};

// Check premium subscription for chat access
const checkSubscription = async (userId) => {
  try {
    const subscription = await Subscription.findOne({
      where: {
        userId,
        status: 'active',
        planType: { [Op.in]: ['premium', 'elite'] },
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gt]: new Date() } }
        ]
      }
    });
    return subscription;
  } catch (error) {
    log.error('Subscription check failed', { userId, error: error.message });
    return null;
  }
};

// Verify mutual match between users
const verifyMutualMatch = async (userId1, userId2) => {
  try {
    const match = await Match.findOne({
      where: {
        [Op.or]: [
          { userId: userId1, matchedUserId: userId2, isMutual: true },
          { userId: userId2, matchedUserId: userId1, isMutual: true }
        ]
      }
    });
    return !!match;
  } catch (error) {
    log.error('Mutual match check failed', { userId1, userId2, error: error.message });
    return false;
  }
};

// Generate consistent room ID for two users
const getRoomId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_room_');
};

// Store interval reference for cleanup
let subscriptionCheckInterval = null;
let rateLimitCleanupInterval = null;

// Initialize socket handler
const initializeSocket = (io) => {
  // Use authentication middleware
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    
    if (config.isDevelopment) {
      console.log(`Socket connected: ${userId} (${socket.id})`);
    }

    // Check subscription on connection
    const subscription = await checkSubscription(userId);
    if (!subscription) {
      socket.emit('error', { 
        code: 'PREMIUM_REQUIRED',
        message: 'Premium subscription required for chat'
      });
      socket.disconnect(true);
      return;
    }

    // Join user's personal room for notifications
    socket.join(`user_${userId}`);

    // ==================== JOIN ROOM ====================
    socket.on('join-room', async (roomId) => {
      try {
        // Rate limit check
        if (!checkRateLimit(socket.id, 'join-room')) {
          socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' });
          return;
        }

        // Extract user IDs from roomId
        const userIds = roomId.split('_room_');
        const otherUserId = userIds.find(id => id !== userId);

        if (!otherUserId) {
          socket.emit('error', { code: 'INVALID_ROOM', message: 'Invalid room ID' });
          return;
        }

        // Verify mutual match
        const isMutual = await verifyMutualMatch(userId, otherUserId);
        if (!isMutual) {
          socket.emit('error', { code: 'NOT_MATCHED', message: 'You can only chat with mutual matches' });
          return;
        }

        socket.join(roomId);
        
        if (config.isDevelopment) {
          console.log(`User ${userId} joined room ${roomId}`);
        }
      } catch (error) {
        log.error('Join room error', { userId, error: error.message });
        socket.emit('error', { code: 'JOIN_FAILED', message: 'Failed to join room' });
      }
    });

    // ==================== LEAVE ROOM ====================
    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      
      if (config.isDevelopment) {
        console.log(`User ${userId} left room ${roomId}`);
      }
    });

    // ==================== SEND MESSAGE ====================
    // Note: Messages are created via REST API, socket just broadcasts
    socket.on('send-message', async ({ roomId, message }) => {
      try {
        // Rate limit check
        if (!checkRateLimit(socket.id, 'send-message')) {
          socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many messages. Please slow down.' });
          return;
        }

        // Validate message object
        if (!message || !message.id || !message.receiverId) {
          socket.emit('error', { code: 'INVALID_MESSAGE', message: 'Invalid message format' });
          return;
        }

        // Extract receiver ID
        const userIds = roomId.split('_room_');
        const receiverId = userIds.find(id => id !== userId);

        if (!receiverId || receiverId !== message.receiverId) {
          socket.emit('error', { code: 'INVALID_RECEIVER', message: 'Invalid receiver' });
          return;
        }

        // Verify the message was actually created by this user
        const dbMessage = await Message.findByPk(message.id);
        if (!dbMessage || dbMessage.senderId !== userId) {
          logSecurityEvent('socket_message_spoofing', userId, { 
            messageId: message.id,
            socketId: socket.id 
          });
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'Unauthorized' });
          return;
        }

        // Broadcast to room
        io.to(roomId).emit('message', message);
        
        // Also notify receiver's personal room
        io.to(`user_${receiverId}`).emit('message', message);
      } catch (error) {
        log.error('Send message error', { userId, error: error.message });
        socket.emit('error', { code: 'SEND_FAILED', message: 'Failed to send message' });
      }
    });

    // ==================== TYPING INDICATOR ====================
    socket.on('typing', ({ receiverId, isTyping }) => {
      // Rate limit check
      if (!checkRateLimit(socket.id, 'typing')) {
        return; // Silently drop typing events when rate limited
      }

      if (!receiverId) return;

      const roomId = getRoomId(userId, receiverId);
      socket.to(roomId).emit('user_typing', {
        userId,
        isTyping
      });
    });

    // ==================== MESSAGE EDITED ====================
    socket.on('message-edited', async ({ roomId, message }) => {
      try {
        if (!message || !message.id) return;

        // Verify message ownership
        const dbMessage = await Message.findByPk(message.id);
        if (!dbMessage || dbMessage.senderId !== userId) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'Unauthorized' });
          return;
        }

        // Broadcast to room
        socket.to(roomId).emit('message-edited', { message });

        // Notify receiver's personal room
        const userIds = roomId.split('_room_');
        const receiverId = userIds.find(id => id !== userId);
        if (receiverId) {
          socket.to(`user_${receiverId}`).emit('message-edited', { message });
        }
      } catch (error) {
        log.error('Message edited error', { userId, error: error.message });
      }
    });

    // ==================== MESSAGE DELETED ====================
    socket.on('message-deleted', async ({ roomId, messageId, receiverId }) => {
      try {
        if (!messageId) return;

        // We can't verify ownership here since the message is deleted
        // The REST API already verified ownership before deletion

        // Broadcast to room
        socket.to(roomId).emit('message-deleted', { messageId });

        // Notify receiver's personal room
        if (receiverId) {
          socket.to(`user_${receiverId}`).emit('message-deleted', { messageId });
        }
      } catch (error) {
        log.error('Message deleted error', { userId, error: error.message });
      }
    });

    // ==================== ONLINE STATUS ====================
    socket.on('get-online-status', async (userIds) => {
      // Rate limit check
      if (!checkRateLimit(socket.id, 'get-online-status')) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' });
        return;
      }

      if (!Array.isArray(userIds)) return;

      const onlineStatuses = {};
      // Limit to 50 users
      for (const id of userIds.slice(0, 50)) {
        if (typeof id !== 'string') continue;
        const room = io.sockets.adapter.rooms.get(`user_${id}`);
        onlineStatuses[id] = room ? room.size > 0 : false;
      }

      socket.emit('online-status', onlineStatuses);
    });

    // ==================== DISCONNECT ====================
    socket.on('disconnect', (reason) => {
      // Clean up rate limit records for this socket
      for (const key of socketRateLimits.keys()) {
        if (key.startsWith(`${socket.id}:`)) {
          socketRateLimits.delete(key);
        }
      }

      if (config.isDevelopment) {
        console.log(`Socket disconnected: ${userId} (${socket.id}) - ${reason}`);
      }
    });

    // ==================== ERROR HANDLING ====================
    socket.on('error', (error) => {
      log.error('Socket error', { userId, error: error.message || error });
    });
  });

  // Periodic subscription check (every 5 minutes)
  subscriptionCheckInterval = setInterval(async () => {
    try {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        if (socket.userId) {
          const subscription = await checkSubscription(socket.userId);
          if (!subscription) {
            socket.emit('error', { 
              code: 'SUBSCRIPTION_EXPIRED',
              message: 'Your subscription has expired'
            });
            socket.disconnect(true);
          }
        }
      }
    } catch (error) {
      log.error('Subscription check interval error', { error: error.message });
    }
  }, 5 * 60 * 1000);

  // Clean up rate limit records every 2 minutes
  rateLimitCleanupInterval = setInterval(cleanupRateLimits, 2 * 60 * 1000);

  // Return cleanup function
  return () => {
    if (subscriptionCheckInterval) {
      clearInterval(subscriptionCheckInterval);
    }
    if (rateLimitCleanupInterval) {
      clearInterval(rateLimitCleanupInterval);
    }
    socketRateLimits.clear();
  };
};

module.exports = initializeSocket;
