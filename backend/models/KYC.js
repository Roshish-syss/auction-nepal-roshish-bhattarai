const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  citizenshipPhoto: {
    url: {
      type: String,
      default: null
    },
    uploadedAt: {
      type: Date,
      default: null
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  citizenshipNumber: {
    type: String,
    trim: true,
    default: null
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  otpCode: {
    type: String,
    default: null
  },
  otpExpiresAt: {
    type: Date,
    default: null
  },
  otpVerifiedAt: {
    type: Date,
    default: null
  },
  adminApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'email_verified', 'document_uploaded', 'under_review', 'approved', 'rejected'],
    default: 'pending'
  },
  verificationAttempts: {
    type: Number,
    default: 0
  },
  lastVerificationAttempt: {
    type: Date,
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
kycSchema.index({ userId: 1 }, { unique: true }); // One KYC record per user
kycSchema.index({ email: 1 });
kycSchema.index({ status: 1 });
kycSchema.index({ adminApproved: 1 });
kycSchema.index({ createdAt: -1 });

// Method to check if KYC is complete
kycSchema.methods.isComplete = function() {
  return this.emailVerified && 
         this.citizenshipPhoto.url && 
         this.adminApproved && 
         this.status === 'approved';
};

// Update updatedAt on save
kycSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('KYC', kycSchema);

