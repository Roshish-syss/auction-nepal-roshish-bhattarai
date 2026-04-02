const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  auctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    required: [true, 'Auction ID is required']
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property ID is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  bidAmount: {
    type: Number,
    required: [true, 'Bid amount is required'],
    min: [0, 'Bid amount must be positive']
  },
  previousBid: {
    type: Number,
    default: null
  },
  isWinningBid: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'outbid', 'winning', 'invalid'],
    default: 'pending'
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  flagged: {
    type: Boolean,
    default: false
  },
  flagReason: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
bidSchema.index({ auctionId: 1, timestamp: -1 });
bidSchema.index({ userId: 1 });
bidSchema.index({ propertyId: 1 });
bidSchema.index({ timestamp: -1 });
bidSchema.index({ status: 1 });
bidSchema.index({ isWinningBid: 1, auctionId: 1 });
bidSchema.index({ userId: 1, auctionId: 1 });

// Compound index for tracking user bids per auction
bidSchema.index({ userId: 1, auctionId: 1, timestamp: -1 });

module.exports = mongoose.model('Bid', bidSchema);

