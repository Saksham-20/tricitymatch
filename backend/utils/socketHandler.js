const { Chat, User, Notification } = require('../models');

const socketHandler = (io, socket) => {
  console.log(`User ${socket.userId} connected to socket`);

  // Join user to their personal room
  socket.join(`user_${socket.userId}`);

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { receiverId, message, messageType = 'text', attachmentUrl } = data;

      // Validate receiver exists
      const receiver = await User.findByPk(receiverId);
      if (!receiver) {
        socket.emit('error', { message: 'Receiver not found' });
        return;
      }

      // Create chat message
      const chatMessage = await Chat.create({
        senderId: socket.userId,
        receiverId,
        message,
        messageType,
        attachmentUrl
      });

      // Populate sender info
      await chatMessage.reload({
        include: [
          { model: User, as: 'sender', attributes: ['id', 'name', 'email'] }
        ]
      });

      // Send message to receiver
      socket.to(`user_${receiverId}`).emit('receive_message', {
        id: chatMessage.id,
        senderId: chatMessage.senderId,
        message: chatMessage.message,
        messageType: chatMessage.messageType,
        attachmentUrl: chatMessage.attachmentUrl,
        createdAt: chatMessage.createdAt,
        sender: chatMessage.sender
      });

      // Send confirmation to sender
      socket.emit('message_sent', {
        id: chatMessage.id,
        status: 'sent'
      });

      // Create notification for receiver
      await Notification.create({
        userId: receiverId,
        type: 'message',
        title: 'New Message',
        content: `You have a new message from ${chatMessage.sender.name}`,
        data: {
          senderId: socket.userId,
          messageId: chatMessage.id
        }
      });

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { receiverId } = data;
    socket.to(`user_${receiverId}`).emit('user_typing', {
      userId: socket.userId,
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    const { receiverId } = data;
    socket.to(`user_${receiverId}`).emit('user_typing', {
      userId: socket.userId,
      isTyping: false
    });
  });

  // Handle message read receipts
  socket.on('mark_as_read', async (data) => {
    try {
      const { messageId } = data;
      
      await Chat.update(
        { isRead: true, readAt: new Date() },
        { where: { id: messageId, receiverId: socket.userId } }
      );

      // Notify sender that message was read
      const message = await Chat.findByPk(messageId);
      if (message) {
        socket.to(`user_${message.senderId}`).emit('message_read', {
          messageId,
          readAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });

  // Handle joining chat room
  socket.on('join_chat', (data) => {
    const { chatPartnerId } = data;
    socket.join(`chat_${socket.userId}_${chatPartnerId}`);
  });

  // Handle leaving chat room
  socket.on('leave_chat', (data) => {
    const { chatPartnerId } = data;
    socket.leave(`chat_${socket.userId}_${chatPartnerId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected from socket`);
  });
};

module.exports = socketHandler;
