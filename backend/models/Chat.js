const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required']
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver ID is required']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    url: String,
    type: String,
    name: String,
    size: Number
  }],
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
chatSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });
chatSchema.index({ receiverId: 1, read: 1, timestamp: -1 });
chatSchema.index({ timestamp: -1 });
chatSchema.index({ senderId: 1, timestamp: -1 });
chatSchema.index({ receiverId: 1, timestamp: -1 });

// Additional indexes for conversation queries
chatSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });
chatSchema.index({ receiverId: 1, senderId: 1, timestamp: -1 });

module.exports = mongoose.model('Chat', chatSchema);

