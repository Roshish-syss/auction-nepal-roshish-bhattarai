const Chat = require('../models/Chat');
const User = require('../models/User');

// Track online users
const onlineUsers = new Map(); // Map<userId, socketId>

const handleChatSocket = (io, socket) => {
  console.log(`User ${socket.userId} connected to chat socket`);

  // Mark user as online
  onlineUsers.set(socket.userId, socket.id);
  io.emit('user_online', { userId: socket.userId });

  // Join user's personal room for direct messages
  socket.join(`user_${socket.userId}`);

  // Send message
  socket.on('send_message', async ({ receiverId, message, conversationId }) => {
    try {
      if (!receiverId || !message) {
        socket.emit('message_error', { message: 'Receiver ID and message are required' });
        return;
      }

      // Create chat message
      const chatMessage = new Chat({
        senderId: socket.userId,
        receiverId: receiverId,
        message: message,
        timestamp: new Date()
      });

      await chatMessage.save();

      // Get populated message data
      const messageData = await Chat.findById(chatMessage._id)
        .populate('senderId', 'fullName email profilePicture')
        .populate('receiverId', 'fullName email profilePicture')
        .lean();

      // Send to receiver if online
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new_message', {
          message: messageData,
          conversationId: conversationId || null
        });
      }

      // Confirm to sender
      socket.emit('message_sent', {
        message: messageData,
        conversationId: conversationId || null
      });

      console.log(`Message sent from ${socket.userId} to ${receiverId}`);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message_error', { message: 'Error sending message' });
    }
  });

  // Get conversation messages
  socket.on('get_messages', async ({ userId }) => {
    try {
      if (!userId) {
        socket.emit('message_error', { message: 'User ID is required' });
        return;
      }

      // Get messages between current user and target user
      const messages = await Chat.find({
        $or: [
          { senderId: socket.userId, receiverId: userId },
          { senderId: userId, receiverId: socket.userId }
        ]
      })
        .populate('senderId', 'fullName email profilePicture')
        .populate('receiverId', 'fullName email profilePicture')
        .sort({ timestamp: 1 })
        .limit(100)
        .lean();

      socket.emit('messages_list', { messages, userId });
    } catch (error) {
      console.error('Get messages error:', error);
      socket.emit('message_error', { message: 'Error fetching messages' });
    }
  });

  // Get user's conversations
  socket.on('get_conversations', async () => {
    try {
      // Get distinct conversations
      const sentMessages = await Chat.find({ senderId: socket.userId })
        .select('receiverId timestamp message')
        .populate('receiverId', 'fullName email profilePicture')
        .sort({ timestamp: -1 })
        .lean();

      const receivedMessages = await Chat.find({ receiverId: socket.userId })
        .select('senderId timestamp message')
        .populate('senderId', 'fullName email profilePicture')
        .sort({ timestamp: -1 })
        .lean();

      // Combine and group by user
      const conversationsMap = new Map();

      // Process sent messages
      sentMessages.forEach(msg => {
        const userId = msg.receiverId._id.toString();
        if (!conversationsMap.has(userId)) {
          conversationsMap.set(userId, {
            otherUser: msg.receiverId,
            lastMessage: msg.message,
            lastMessageTime: msg.timestamp,
            unreadCount: 0
          });
        }
      });

      // Process received messages
      receivedMessages.forEach(msg => {
        const userId = msg.senderId._id.toString();
        if (!conversationsMap.has(userId)) {
          conversationsMap.set(userId, {
            otherUser: msg.senderId,
            lastMessage: msg.message,
            lastMessageTime: msg.timestamp,
            unreadCount: 0
          });
        } else {
          // Update if this is more recent
          const existing = conversationsMap.get(userId);
          if (new Date(msg.timestamp) > new Date(existing.lastMessageTime)) {
            existing.lastMessage = msg.message;
            existing.lastMessageTime = msg.timestamp;
            existing.unreadCount = (existing.unreadCount || 0) + 1;
          }
        }
      });

      const conversations = Array.from(conversationsMap.values()).sort(
        (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      );

      socket.emit('conversations_list', { conversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      socket.emit('message_error', { message: 'Error fetching conversations' });
    }
  });

  // Mark messages as read
  socket.on('mark_read', async ({ userId }) => {
    try {
      await Chat.updateMany(
        {
          senderId: userId,
          receiverId: socket.userId,
          read: false
        },
        { read: true, readAt: new Date() }
      );

      socket.emit('messages_read', { userId });
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
    io.emit('user_offline', { userId: socket.userId });
    console.log(`User ${socket.userId} disconnected from chat socket`);
  });
};

module.exports = handleChatSocket;

