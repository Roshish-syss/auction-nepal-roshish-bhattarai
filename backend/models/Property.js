const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Property title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Property description is required']
  },
  location: {
    address: {
      type: String,
      required: [true, 'Address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    district: String,
    province: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  type: {
    type: String,
    enum: ['house', 'apartment', 'villa', 'land', 'commercial'],
    required: [true, 'Property type is required']
  },
  specifications: {
    bedrooms: Number,
    bathrooms: Number,
    area: {
      type: Number,
      required: [true, 'Area is required']
    },
    areaUnit: {
      type: String,
      enum: ['sqft', 'sqm', 'aana', 'ropani'],
      default: 'sqft'
    },
    floors: Number,
    parking: Boolean,
    furnishing: {
      type: String,
      enum: ['furnished', 'semi-furnished', 'unfurnished'],
      default: 'unfurnished'
    }
  },
  photos: [{
    url: {
      type: String,
      required: true
    },
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  documents: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['citizenship', 'land-certificate', 'tax-document', 'other']
    }
  }],
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Base price must be positive']
  },
  depositAmount: {
    type: Number,
    required: [true, 'Deposit amount is required'],
    min: [0, 'Deposit amount must be positive']
  },
  auctionTime: {
    type: Date,
    required: [true, 'Auction time is required']
  },
  auctionDuration: {
    type: Number,
    default: 60, // Duration in minutes
    min: [1, 'Auction duration must be at least 1 minute']
  },
  status: {
    type: String,
    enum: ['draft', 'upcoming', 'live', 'completed', 'cancelled'],
    default: 'draft'
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required']
  },
  listedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Listed by user ID is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
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
propertySchema.index({ status: 1, auctionTime: 1 });
propertySchema.index({ ownerId: 1 });
propertySchema.index({ location: { city: 1 } });
propertySchema.index({ type: 1 });
propertySchema.index({ featured: 1, status: 1 });
propertySchema.index({ createdAt: -1 });

// Update updatedAt on save
propertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Property', propertySchema);

