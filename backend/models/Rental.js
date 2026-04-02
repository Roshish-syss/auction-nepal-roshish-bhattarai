const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property ID is required']
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required']
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  monthlyRent: {
    type: Number,
    required: [true, 'Monthly rent is required'],
    min: [0, 'Monthly rent must be positive']
  },
  securityDeposit: {
    type: Number,
    default: 0,
    min: [0, 'Security deposit must be positive']
  },
  availability: {
    type: String,
    enum: ['available', 'rented', 'unavailable'],
    default: 'available'
  },
  leaseStartDate: {
    type: Date,
    default: null
  },
  leaseEndDate: {
    type: Date,
    default: null
  },
  leaseDuration: {
    type: Number, // Duration in months
    default: null
  },
  description: {
    type: String,
    default: null
  },
  requirements: {
    minAge: Number,
    maxAge: Number,
    gender: {
      type: String,
      enum: ['male', 'female', 'any'],
      default: 'any'
    },
    employment: {
      type: String,
      enum: ['required', 'preferred', 'not_required'],
      default: 'preferred'
    }
  },
  amenities: [{
    type: String,
    enum: ['furnished', 'parking', 'water', 'electricity', 'internet', 'security', 'gym', 'pool', 'garden']
  }],
  applications: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    message: String
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  views: {
    type: Number,
    default: 0
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
rentalSchema.index({ ownerId: 1 });
rentalSchema.index({ tenantId: 1 });
rentalSchema.index({ propertyId: 1 });
rentalSchema.index({ availability: 1, status: 1 });
rentalSchema.index({ monthlyRent: 1 });
rentalSchema.index({ createdAt: -1 });
rentalSchema.index({ status: 1, availability: 1 });

// Update updatedAt on save
rentalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Rental', rentalSchema);

