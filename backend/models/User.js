const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[0-9]{10}$/, 'Phone number must be 10 digits']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  kycVerified: {
    type: Boolean,
    default: false
  },
  kycData: {
    citizenshipPhoto: String,
    emailVerified: {
      type: Boolean,
      default: false
    },
    adminApproved: {
      type: Boolean,
      default: false
    }
  },
  depositEligible: {
    type: Boolean,
    default: false
  },
  depositData: {
    amount: Number,
    paymentProof: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'refunded'],
      default: 'pending'
    },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'completed'],
      default: 'none'
    }
  },
  secretCode: {
    type: String,
    default: null
  },
  auctionGroupLink: {
    type: String,
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  refreshTokenExpires: {
    type: Date,
    default: null
  },
  agreedToTerms: {
    type: Boolean,
    default: false
  },
  agreedToTermsAt: {
    type: Date,
    default: null
  },
  termsVersion: {
    type: String,
    default: '1.0'
  },
  profilePicture: {
    url: {
      type: String,
      default: null
    },
    public_id: {
      type: String,
      default: null
    },
    uploadedAt: {
      type: Date,
      default: null
    }
  },
  walletBalance: {
    type: Number,
    default: 0,
    min: [0, 'Wallet balance cannot be negative']
  },
  walletTransactions: [{
    transactionType: {
      type: String,
      enum: ['topup', 'deposit', 'refund', 'deduction'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    paymentProof: {
      type: String,
      default: null
    },
    paymentMethod: {
      type: String,
      enum: ['khalti', 'esewa', 'wallet'],
      default: null
    },
    phoneNumber: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update updatedAt on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);

