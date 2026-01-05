const { Message, Match, Subscription } = require('../models');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');

const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

const initializeSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join user's personal room
    socket.join(`user_${socket.userId}`);

    // Check subscription for chat access
    const subscription = await Subscription.findOne({
      where: {
        userId: socket.userId,
        status: 'active',
        planType: { [Op.in]: ['premium', 'elite'] }
      }
    });

    if (!subscription) {
      socket.emit('error', { message: 'Premium subscription required for chat' });
      socket.disconnect();
      return;
    }

    // Handle joining a conversation room
    socket.on('join-room', async (roomId) => {
      // Extract user IDs from roomId (format: userId1-userId2)
      const userIds = roomId.split('-');
      const otherUserId = userIds.find(id => id !== socket.userId);
      
      if (!otherUserId) {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }
      // Verify mutual match
      const match = await Match.findOne({
        where: {
          [Op.or]: [
            { userId: socket.userId, matchedUserId: otherUserId, isMutual: true },
            { userId: otherUserId, matchedUserId: socket.userId, isMutual: true }
          ]
        }
      });

      if (!match) {
        socket.emit('error', { message: 'You can only chat with mutual matches' });
        return;
      }

      socket.join(roomId);
      console.log(`User ${socket.userId} joined room ${roomId}`);
    });

    // Handle sending a message (messages are created via API, socket just broadcasts)
    socket.on('send-message', async ({ roomId, message }) => {
      try {
        // Extract receiver ID from roomId
        const userIds = roomId.split('-');
        const receiverId = userIds.find(id => id !== socket.userId);
        
        if (!receiverId) {
          socket.emit('error', { message: 'Invalid room ID' });
          return;
        }

        // Verify mutual match
        const match = await Match.findOne({
          where: {
            [Op.or]: [
              { userId: socket.userId, matchedUserId: receiverId, isMutual: true },
              { userId: receiverId, matchedUserId: socket.userId, isMutual: true }
            ]
          }
        });

        if (!match) {
          socket.emit('error', { message: 'You can only message mutual matches' });
          return;
        }

        // Broadcast message to room (message already created via API)
        io.to(roomId).emit('message', message);
        
        // Also notify the receiver in their personal room
        io.to(`user_${receiverId}`).emit('message', message);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ receiverId, isTyping }) => {
      const roomId = [socket.userId, receiverId].sort().join('-');
      socket.to(roomId).emit('user_typing', {
        userId: socket.userId,
        isTyping
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
};

module.exports = initializeSocket;

