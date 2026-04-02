const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
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
  amount: {
    type: Number,
    required: [true, 'Deposit amount is required'],
    min: [0, 'Deposit amount must be positive']
  },
  paymentMethod: {
    type: String,
    enum: ['esewa', 'khalti', 'wallet'],
    required: [true, 'Payment method is required']
  },
  transactionId: {
    type: String,
    default: null
  },
  paymentProof: {
    url: {
      type: String,
      required: [true, 'Payment proof is required']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required']
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'approved', 'rejected', 'refunded'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'processing', 'completed', 'failed'],
    default: 'none'
  },
  refundAmount: {
    type: Number,
    default: null
  },
  refundTransactionId: {
    type: String,
    default: null
  },
  refundedAt: {
    type: Date,
    default: null
  },
  refundReason: {
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
// Note: userId index is covered by the compound index below, but kept for query optimization
depositSchema.index({ auctionId: 1 });
depositSchema.index({ propertyId: 1 });
depositSchema.index({ status: 1 });
depositSchema.index({ refundStatus: 1 });
depositSchema.index({ transactionId: 1 });
depositSchema.index({ createdAt: -1 });
depositSchema.index({ userId: 1, auctionId: 1 }, { unique: true }); // One deposit per user per auction

// Update updatedAt on save
depositSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Deposit', depositSchema);

