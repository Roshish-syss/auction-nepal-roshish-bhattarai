const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property ID is required']
  },
  currentBid: {
    type: Number,
    default: 0
  },
  highestBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  startingBid: {
    type: Number,
    required: [true, 'Starting bid is required'],
    min: [0, 'Starting bid must be positive']
  },
  bidIncrement: {
    type: Number,
    default: 1000, // Minimum increment in NPR
    min: [1, 'Bid increment must be at least 1']
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'paused', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required']
  },
  actualEndTime: {
    type: Date,
    default: null
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    depositPaid: {
      type: Boolean,
      default: false
    }
  }],
  totalBids: {
    type: Number,
    default: 0
  },
  winner: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    winningBid: {
      type: Number,
      default: null
    },
    finalizedAt: {
      type: Date,
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: null
    }
  },
  secretCode: {
    type: String,
    required: true
  },
  groupLink: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
auctionSchema.index({ propertyId: 1 }, { unique: true }); // One auction per property
auctionSchema.index({ status: 1, startTime: 1 });
auctionSchema.index({ 'participants.userId': 1 });
auctionSchema.index({ highestBidder: 1 });
auctionSchema.index({ secretCode: 1 }, { unique: true }); // Unique secret codes

// Method to check if auction is live
auctionSchema.methods.isLive = function() {
  const now = new Date();
  return this.status === 'live' && 
         this.startTime <= now && 
         this.endTime >= now;
};

// Method to check if auction has ended
auctionSchema.methods.hasEnded = function() {
  return this.status === 'completed' || 
         (this.endTime < new Date() && this.status !== 'cancelled');
};

// Update updatedAt on save
auctionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Auction', auctionSchema);

