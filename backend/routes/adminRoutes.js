const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Property = require('../models/Property');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Deposit = require('../models/Deposit');
const KYC = require('../models/KYC');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { uploadMultiple, handleUploadError } = require('../middleware/uploadMiddleware');
const { uploadDocument, uploadDocuments, handleDocumentUploadError } = require('../middleware/documentUploadMiddleware');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { detectSuspiciousBids } = require('../utils/suspiciousBidDetector');
const { normalizePropertyLocation } = require('../utils/propertyLocation');
const { geocodeSearch } = require('../utils/geocodeService');
const {
  createDepositApprovedNotification,
  createDepositRejectedNotification,
  createWalletTopUpApprovedNotification
} = require('../utils/notificationService');
const bcrypt = require('bcryptjs');
const { syncAuctionTimelinesFromDb, getIoOrNoop } = require('../utils/auctionLifecycleSync');
const {
  ensureAuctionForProperty,
  ensureAuctionsForOrphanUpcomingProperties,
  syncScheduledAuctionFromSavedProperty,
  syncAuctionWithPropertySchedule
} = require('../utils/ensureAuctionForProperty');

// All routes require admin authentication
router.use(authMiddleware);
router.use(adminMiddleware);

// ========== DASHBOARD STATISTICS ==========

// @route   GET /api/admin/dashboard/stats
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard/stats', async (req, res) => {
  try {
    await ensureAuctionsForOrphanUpcomingProperties();
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const [
      totalUsers,
      totalProperties,
      totalAuctions,
      pendingKYCs,
      pendingDeposits,
      totalRevenue,
      activeAuctions,
      pendingWalletTopupsResult
    ] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Auction.countDocuments(),
      KYC.countDocuments({ status: { $in: ['document_uploaded', 'under_review'] } }),
      Deposit.countDocuments({ status: 'pending' }),
      Deposit.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Auction.countDocuments({ status: 'live' }),
      User.aggregate([
        { $match: { 'walletTransactions.transactionType': 'topup', 'walletTransactions.status': 'pending' } },
        { $unwind: '$walletTransactions' },
        { $match: { 'walletTransactions.transactionType': 'topup', 'walletTransactions.status': 'pending' } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ])
    ]);

    const revenue = totalRevenue[0]?.total || 0;
    const pendingWalletTopups = pendingWalletTopupsResult[0]?.count || 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProperties,
        totalAuctions,
        pendingKYCs,
        pendingDeposits,
        pendingWalletTopups,
        totalRevenue: revenue,
        activeAuctions
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
});

// ========== USER MANAGEMENT ==========

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, kycVerified } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }
    
    if (kycVerified !== undefined) {
      query.kycVerified = kycVerified === 'true';
    }

    const users = await User.find(query)
      .select('-password -refreshToken -passwordResetToken')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// @route   GET /api/admin/users/:userId
// @desc    Get single user details
// @access  Private (Admin only)
router.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -refreshToken -passwordResetToken')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's KYC status
    const kyc = await KYC.findOne({ userId: user._id }).lean();
    
    // Get user's deposits
    const deposits = await Deposit.find({ userId: user._id })
      .populate('propertyId', 'title')
      .lean();

    res.json({
      success: true,
      user: {
        ...user,
        kyc: kyc || null,
        deposits: deposits || []
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/users/:userId
// @desc    Update user information
// @access  Private (Admin only)
router.put('/users/:userId', [
  body('fullName').optional().trim(),
  body('phoneNumber').optional().matches(/^[0-9]{10}$/),
  body('role').optional().isIn(['user', 'admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { fullName, phoneNumber, role } = req.body;
    const updates = {};

    if (fullName) updates.fullName = fullName;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (role) updates.role = role;

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken -passwordResetToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
});

// @route   DELETE /api/admin/users/:userId
// @desc    Delete user (soft delete - ban)
// @access  Private (Admin only)
router.delete('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    // Soft delete - mark as banned or inactive
    // For now, we'll just delete the user
    await User.findByIdAndDelete(req.params.userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
});

// ========== WALLET TOP-UP MANAGEMENT ==========

// @route   GET /api/admin/wallet/topups
// @desc    Get all pending wallet top-ups
// @access  Private (Admin only)
router.get('/wallet/topups', async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    
    // Find all users with pending top-up transactions
    const users = await User.find({
      'walletTransactions.transactionType': 'topup',
      'walletTransactions.status': status
    })
      .select('fullName email phoneNumber walletTransactions walletBalance')
      .lean();

    // Extract and flatten transactions
    let topups = [];
    users.forEach(user => {
      user.walletTransactions
        .filter(t => t.transactionType === 'topup' && t.status === status)
        .forEach(transaction => {
          topups.push({
            _id: transaction._id,
            userId: user._id,
            userName: user.fullName,
            userEmail: user.email,
            userPhone: user.phoneNumber,
            amount: transaction.amount,
            paymentMethod: transaction.paymentMethod,
            phoneNumber: transaction.phoneNumber,
            paymentProof: transaction.paymentProof,
            description: transaction.description,
            status: transaction.status,
            createdAt: transaction.createdAt
          });
        });
    });

    // Sort by date (newest first)
    topups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTopups = topups.slice(startIndex, endIndex);

    res.json({
      success: true,
      topups: paginatedTopups,
      total: topups.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(topups.length / limit)
    });
  } catch (error) {
    console.error('Get wallet top-ups error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet top-ups',
      error: error.message
    });
  }
});

// @route   POST /api/admin/wallet/topups/:transactionId/approve
// @desc    Approve wallet top-up
// @access  Private (Admin only)
router.post('/wallet/topups/:transactionId/approve', async (req, res) => {
  try {
    const { transactionId } = req.params;

    // Find user with this transaction
    const user = await User.findOne({
      'walletTransactions._id': transactionId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Top-up transaction not found'
      });
    }

    // Find the specific transaction
    const transaction = user.walletTransactions.id(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Top-up already approved'
      });
    }

    if (transaction.transactionType !== 'topup') {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction type'
      });
    }

    // Update transaction status
    transaction.status = 'approved';

    // Add amount to wallet balance
    user.walletBalance = (user.walletBalance || 0) + transaction.amount;

    await user.save();

    // Create notification
    try {
      const formatPrice = (price) => new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 0
      }).format(price);
      
      await createWalletTopUpApprovedNotification(
        user._id,
        transactionId,
        formatPrice(transaction.amount)
      );
    } catch (notifError) {
      console.error('Error creating wallet top-up notification:', notifError);
      // Don't fail the request if notification creation fails
    }

    res.json({
      success: true,
      message: 'Wallet top-up approved successfully',
      newBalance: user.walletBalance
    });
  } catch (error) {
    console.error('Approve wallet top-up error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving wallet top-up',
      error: error.message
    });
  }
});

// @route   POST /api/admin/wallet/topups/:transactionId/reject
// @desc    Reject wallet top-up
// @access  Private (Admin only)
router.post('/wallet/topups/:transactionId/reject', [
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { transactionId } = req.params;
    const { reason } = req.body;

    // Find user with this transaction
    const user = await User.findOne({
      'walletTransactions._id': transactionId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Top-up transaction not found'
      });
    }

    // Find the specific transaction
    const transaction = user.walletTransactions.id(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Top-up already rejected'
      });
    }

    // Update transaction status
    transaction.status = 'rejected';
    if (reason) {
      transaction.description = `${transaction.description} (Rejected: ${reason})`;
    }

    await user.save();

    try {
      const { createWalletTopUpRejectedNotification } = require('../utils/notificationService');
      const amt = new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 0
      }).format(transaction.amount);
      await createWalletTopUpRejectedNotification(user._id, amt, reason);
    } catch (notifErr) {
      console.error('Top-up rejected notification:', notifErr);
    }

    res.json({
      success: true,
      message: 'Wallet top-up rejected successfully'
    });
  } catch (error) {
    console.error('Reject wallet top-up error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting wallet top-up',
      error: error.message
    });
  }
});

// @route   POST /api/admin/users/:userId/reset-password
// @desc    Reset user password
// @access  Private (Admin only)
router.post('/users/:userId/reset-password', [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent resetting admin passwords (security measure)
    if (user.role === 'admin' && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset another admin\'s password'
      });
    }

    const { newPassword } = req.body;

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear refresh token to force re-login
    user.refreshToken = null;
    user.refreshTokenExpires = null;

    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully. User will need to login with new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
});

// ========== PROPERTY MANAGEMENT ==========

// @route   GET /api/admin/geocode
// @desc    Forward geocode address → lat/lng (Nominatim)
// @access  Private (Admin)
router.get('/geocode', async (req, res) => {
  try {
    const q = req.query.q || req.query.query;
    const result = await geocodeSearch(q);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No results found. Try a fuller address (street, city, Nepal).'
      });
    }
    res.json({
      success: true,
      lat: result.lat,
      lng: result.lng,
      displayName: result.displayName
    });
  } catch (error) {
    const status = error.status || 500;
    console.error('Geocode error:', error);
    res.status(status).json({
      success: false,
      message: error.message || 'Geocoding failed'
    });
  }
});

// @route   POST /api/admin/properties
// @desc    Create new property
// @access  Private (Admin only)
router.post('/properties', [
  uploadMultiple,
  handleUploadError,
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('type').isIn(['house', 'apartment', 'villa', 'land', 'commercial']).withMessage('Invalid property type'),
  body('basePrice').notEmpty().withMessage('Base price is required').custom((value) => {
    if (isNaN(value) || parseFloat(value) <= 0) {
      throw new Error('Base price must be a positive number');
    }
    return true;
  }),
  body('depositAmount').notEmpty().withMessage('Deposit amount is required').custom((value) => {
    if (isNaN(value) || parseFloat(value) <= 0) {
      throw new Error('Deposit amount must be a positive number');
    }
    return true;
  }),
  body('auctionTime').notEmpty().withMessage('Auction time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    
    // Parse JSON fields
    let location, specifications, documents;
    let locationParseError = null;

    try {
      if (req.body.location) {
        location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
      }
    } catch (parseError) {
      locationParseError = 'Invalid location data format';
    }
    
    if (req.body.specifications) {
      try {
        specifications = typeof req.body.specifications === 'string' ? JSON.parse(req.body.specifications) : req.body.specifications;
      } catch (e) {
        // Specifications are optional, so just log the error
        console.error('Error parsing specifications:', e);
      }
    }
    
    if (req.body.documents) {
      try {
        documents = typeof req.body.documents === 'string' ? JSON.parse(req.body.documents) : req.body.documents;
      } catch (e) {
        // Documents are optional, so just log the error
        console.error('Error parsing documents:', e);
      }
    }

    if (locationParseError) {
      errors.errors = errors.errors || [];
      errors.errors.push({ msg: locationParseError, param: 'location' });
    }

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      type,
      basePrice,
      depositAmount,
      auctionTime,
      auctionDuration,
      ownerId
    } = req.body;

    // Upload photos
    const photos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await uploadToCloudinary(file, 'auctionnepal/properties');
        photos.push({
          url: uploadResult.url,
          public_id: uploadResult.public_id,
          isPrimary: photos.length === 0 // First image is primary
        });
      }
    }

    const locationData = normalizePropertyLocation(location);
    if (!locationData || !locationData.address || !locationData.city) {
      return res.status(400).json({
        success: false,
        message: 'Location address and city are required',
        errors: [{ msg: 'Location address and city are required', param: 'location' }]
      });
    }

    const specificationsData = specifications || {};
    const documentsData = documents || [];

    const property = new Property({
      title,
      description,
      location: locationData,
      type,
      specifications: specificationsData,
      basePrice: parseFloat(basePrice),
      depositAmount: parseFloat(depositAmount),
      auctionTime: new Date(auctionTime),
      auctionDuration: auctionDuration ? parseInt(auctionDuration) : 60,
      ownerId: ownerId || req.user._id,
      listedBy: req.user._id,
      createdBy: req.user._id,
      photos,
      documents: documentsData,
      status: 'upcoming'
    });

    await property.save();

    try {
      await ensureAuctionForProperty(property);
    } catch (auctionErr) {
      console.error('Create auction for property error:', auctionErr);
      return res.status(500).json({
        success: false,
        message: 'Property was saved but auction could not be created. Try editing the property or contact support.',
        error: auctionErr.message
      });
    }

    res.json({
      success: true,
      message: 'Property created successfully',
      property
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating property',
      error: error.message
    });
  }
});

// @route   GET /api/admin/properties
// @desc    Get all properties with filters
// @access  Private (Admin only)
router.get('/properties', async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const { page = 1, limit = 20, status, search } = req.query;
    
    const query = {};

    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'live' };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }

    const properties = await Property.find(query)
      .populate('ownerId', 'fullName email')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Property.countDocuments(query);

    res.json({
      success: true,
      properties,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
});

// @route   GET /api/admin/properties/:propertyId
// @desc    Get single property details
// @access  Private (Admin only)
router.get('/properties/:propertyId', async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const property = await Property.findById(req.params.propertyId)
      .populate('ownerId', 'fullName email phoneNumber')
      .populate('createdBy', 'fullName')
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.json({
      success: true,
      property
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching property',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/properties/:propertyId
// @desc    Update property (multipart body, same shape as create; optional new photos)
// @access  Private (Admin only)
router.put('/properties/:propertyId', [
  uploadMultiple,
  handleUploadError,
  body('title').optional().notEmpty(),
  body('basePrice').optional().isNumeric(),
  body('depositAmount').optional().isNumeric(),
  body('status').optional().isIn(['draft', 'upcoming', 'live', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const property = await Property.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    let location;
    if (req.body.location) {
      try {
        location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location JSON'
        });
      }
    }

    let specifications;
    if (req.body.specifications) {
      try {
        specifications =
          typeof req.body.specifications === 'string'
            ? JSON.parse(req.body.specifications)
            : req.body.specifications;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid specifications JSON'
        });
      }
    }

    if (req.body.title !== undefined) property.title = req.body.title;
    if (req.body.description !== undefined) property.description = req.body.description;
    if (req.body.type !== undefined) property.type = req.body.type;
    if (req.body.basePrice !== undefined && req.body.basePrice !== '') {
      property.basePrice = parseFloat(req.body.basePrice);
    }
    if (req.body.depositAmount !== undefined && req.body.depositAmount !== '') {
      property.depositAmount = parseFloat(req.body.depositAmount);
    }
    if (req.body.auctionTime !== undefined && req.body.auctionTime !== '') {
      property.auctionTime = new Date(req.body.auctionTime);
    }
    if (req.body.auctionDuration !== undefined && req.body.auctionDuration !== '') {
      property.auctionDuration = parseInt(req.body.auctionDuration, 10);
    }
    if (req.body.status !== undefined) property.status = req.body.status;

    if (location) {
      const normalized = normalizePropertyLocation(location);
      if (!normalized || !normalized.address || !normalized.city) {
        return res.status(400).json({
          success: false,
          message: 'Location address and city are required'
        });
      }
      property.location = {
        address: normalized.address,
        city: normalized.city,
        district: normalized.district,
        province: normalized.province,
        ...(normalized.coordinates ? { coordinates: normalized.coordinates } : {})
      };
      property.markModified('location');
    }

    if (specifications) {
      const prev = property.specifications?.toObject?.() || property.specifications || {};
      property.specifications = {
        bedrooms:
          specifications.bedrooms !== undefined && specifications.bedrooms !== ''
            ? parseInt(specifications.bedrooms, 10)
            : prev.bedrooms,
        bathrooms:
          specifications.bathrooms !== undefined && specifications.bathrooms !== ''
            ? parseInt(specifications.bathrooms, 10)
            : prev.bathrooms,
        area:
          specifications.area !== undefined && specifications.area !== ''
            ? parseFloat(specifications.area)
            : prev.area,
        areaUnit: specifications.areaUnit || prev.areaUnit || 'sqft',
        floors: specifications.floors !== undefined ? specifications.floors : prev.floors,
        parking: specifications.parking !== undefined ? specifications.parking : prev.parking,
        furnishing: specifications.furnishing !== undefined ? specifications.furnishing : prev.furnishing
      };
      property.markModified('specifications');
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await uploadToCloudinary(file, 'auctionnepal/properties');
        property.photos.push({
          url: uploadResult.url,
          public_id: uploadResult.public_id,
          isPrimary: property.photos.length === 0
        });
      }
    }

    await property.save();

    const scheduleChanged =
      (req.body.auctionTime !== undefined && req.body.auctionTime !== '') ||
      (req.body.auctionDuration !== undefined && req.body.auctionDuration !== '');

    try {
      await ensureAuctionForProperty(property);
      const io = getIoOrNoop(req);
      if (scheduleChanged) {
        await syncAuctionWithPropertySchedule(property, io);
      } else {
        await syncScheduledAuctionFromSavedProperty(property);
      }
      await syncAuctionTimelinesFromDb(io);
    } catch (auctionErr) {
      console.error('Sync auction after property update:', auctionErr);
    }

    const propertyOut = await Property.findById(property._id)
      .populate('ownerId', 'fullName email phoneNumber')
      .populate('createdBy', 'fullName')
      .lean();

    res.json({
      success: true,
      message: 'Property updated successfully',
      property: propertyOut
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating property',
      error: error.message
    });
  }
});

// @route   DELETE /api/admin/properties/:propertyId
// @desc    Delete property
// @access  Private (Admin only)
router.delete('/properties/:propertyId', async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Delete photos from Cloudinary
    if (property.photos && property.photos.length > 0) {
      for (const photo of property.photos) {
        if (photo.public_id) {
          try {
            await deleteFromCloudinary(photo.public_id);
          } catch (error) {
            console.error('Error deleting photo:', error);
          }
        }
      }
    }

    await Auction.deleteMany({ propertyId: req.params.propertyId });
    await Property.findByIdAndDelete(req.params.propertyId);

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting property',
      error: error.message
    });
  }
});

// ========== DEPOSIT MANAGEMENT ==========

// @route   GET /api/admin/deposits
// @desc    Get all deposits with filters
// @access  Private (Admin only)
router.get('/deposits', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const deposits = await Deposit.find(query)
      .populate('userId', 'fullName email phoneNumber')
      .populate('propertyId', 'title basePrice')
      .populate('auctionId', 'status')
      .populate('verifiedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Deposit.countDocuments(query);

    res.json({
      success: true,
      deposits,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get deposits error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching deposits',
      error: error.message
    });
  }
});

// @route   GET /api/admin/deposits/:depositId
// @desc    Get single deposit details
// @access  Private (Admin only)
router.get('/deposits/:depositId', async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.depositId)
      .populate('userId', 'fullName email phoneNumber')
      .populate('propertyId', 'title basePrice depositAmount')
      .populate('auctionId', 'status')
      .populate('verifiedBy', 'fullName')
      .lean();

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }

    res.json({
      success: true,
      deposit
    });
  } catch (error) {
    console.error('Get deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching deposit',
      error: error.message
    });
  }
});

// @route   POST /api/admin/deposits/:depositId/approve
// @desc    Approve deposit
// @access  Private (Admin only)
router.post('/deposits/:depositId/approve', async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.depositId);

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }

    if (deposit.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Deposit already approved'
      });
    }

    deposit.status = 'approved';
    deposit.verifiedBy = req.user._id;
    deposit.verifiedAt = new Date();
    await deposit.save();

    // Populate propertyId
    await deposit.populate('propertyId', 'title');

    // Update user's deposit eligibility and add to wallet balance
    const user = await User.findById(deposit.userId);
    user.depositEligible = true;
    user.depositData = {
      amount: deposit.amount,
      paymentProof: deposit.paymentProof.url,
      status: 'approved'
    };
    
    // Add deposit amount to wallet balance (if not already from wallet)
    if (deposit.paymentMethod !== 'wallet') {
      user.walletBalance = (user.walletBalance || 0) + deposit.amount;
      user.walletTransactions.push({
        transactionType: 'topup',
        amount: deposit.amount,
        description: `Deposit approved for ${deposit.propertyId?.title || 'auction'}`,
        relatedId: deposit._id,
        status: 'approved',
        paymentMethod: deposit.paymentMethod,
        createdAt: new Date()
      });
    }
    
    await user.save();

    // Create notification
    try {
      const propertyTitle = deposit.propertyId?.title || 'Property';
      const formatPrice = (price) => new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 0
      }).format(price);
      
      await createDepositApprovedNotification(
        deposit.userId,
        deposit._id,
        propertyTitle,
        formatPrice(deposit.amount)
      );
    } catch (notifError) {
      console.error('Error creating deposit approved notification:', notifError);
      // Don't fail the request if notification creation fails
    }

    res.json({
      success: true,
      message: 'Deposit approved successfully',
      deposit
    });
  } catch (error) {
    console.error('Approve deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving deposit',
      error: error.message
    });
  }
});

// @route   POST /api/admin/deposits/:depositId/reject
// @desc    Reject deposit
// @access  Private (Admin only)
router.post('/deposits/:depositId/reject', [
  body('reason').notEmpty().withMessage('Rejection reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { reason } = req.body;
    const deposit = await Deposit.findById(req.params.depositId);

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }

    deposit.status = 'rejected';
    deposit.rejectionReason = reason;
    deposit.verifiedBy = req.user._id;
    deposit.verifiedAt = new Date();
    await deposit.save();

    // Populate propertyId
    await deposit.populate('propertyId', 'title');

    // Create notification
    try {
      const propertyTitle = deposit.propertyId?.title || 'Property';
      const formatPrice = (price) => new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 0
      }).format(price);
      
      await createDepositRejectedNotification(
        deposit.userId,
        deposit._id,
        propertyTitle,
        formatPrice(deposit.amount),
        reason
      );
    } catch (notifError) {
      console.error('Error creating deposit rejected notification:', notifError);
      // Don't fail the request if notification creation fails
    }

    res.json({
      success: true,
      message: 'Deposit rejected successfully',
      deposit
    });
  } catch (error) {
    console.error('Reject deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting deposit',
      error: error.message
    });
  }
});

// ========== AUCTION MANAGEMENT ==========

// @route   GET /api/admin/auctions
// @desc    Get all auctions with filters
// @access  Private (Admin only)
router.get('/auctions', async (req, res) => {
  try {
    await ensureAuctionsForOrphanUpcomingProperties();
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const { page = 1, limit = 20, status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const auctions = await Auction.find(query)
      .populate('propertyId', 'title basePrice depositAmount')
      .populate('highestBidder', 'fullName email')
      .populate('winner.userId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Auction.countDocuments(query);

    // Get bid counts for each auction
    const auctionsWithBids = await Promise.all(
      auctions.map(async (auction) => {
        const bidCount = await Bid.countDocuments({ auctionId: auction._id });
        return { ...auction, bidCount };
      })
    );

    res.json({
      success: true,
      auctions: auctionsWithBids,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get auctions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auctions',
      error: error.message
    });
  }
});

// @route   GET /api/admin/auctions/:auctionId
// @desc    Get single auction details with bids
// @access  Private (Admin only)
router.get('/auctions/:auctionId', async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const auction = await Auction.findById(req.params.auctionId)
      .populate('propertyId', 'title basePrice depositAmount')
      .populate('highestBidder', 'fullName email phoneNumber')
      .populate('winner.userId', 'fullName email phoneNumber')
      .lean();

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Get all bids for this auction
    const bids = await Bid.find({ auctionId: auction._id })
      .populate('userId', 'fullName email')
      .sort({ timestamp: -1 })
      .lean();

    res.json({
      success: true,
      auction: {
        ...auction,
        bids
      }
    });
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auction',
      error: error.message
    });
  }
});

// @route   PATCH /api/admin/auctions/:auctionId/join-key
// @desc    Set or change auction join key (for viewers without deposit)
// @access  Private (Admin)
router.patch(
  '/auctions/:auctionId/join-key',
  body('secretCode')
    .trim()
    .isLength({ min: 4, max: 128 })
    .withMessage('Join key must be between 4 and 128 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const auction = await Auction.findById(req.params.auctionId);
      if (!auction) {
        return res.status(404).json({
          success: false,
          message: 'Auction not found'
        });
      }

      const nextCode = String(req.body.secretCode).trim();
      const duplicate = await Auction.findOne({
        secretCode: nextCode,
        _id: { $ne: auction._id }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'This join key is already used by another auction. Choose a different one.'
        });
      }

      auction.secretCode = nextCode;
      await auction.save();

      res.json({
        success: true,
        message: 'Auction join key updated'
      });
    } catch (error) {
      console.error('Update join key error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating join key',
        error: error.message
      });
    }
  }
);

// @route   POST /api/admin/auctions/:auctionId/end
// @desc    End auction manually
// @access  Private (Admin only)
router.post('/auctions/:auctionId/end', async (req, res) => {
  try {
    const { endAuction } = require('../socket/auctionHandler');
    const io = req.app.get('io'); // Get io instance from app

    if (!io) {
      return res.status(500).json({
        success: false,
        message: 'Socket.IO server not available'
      });
    }

    await endAuction(io, req.params.auctionId, req.user.fullName || req.user.email);

    res.json({
      success: true,
      message: 'Auction ended successfully'
    });
  } catch (error) {
    console.error('End auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending auction',
      error: error.message
    });
  }
});

// @route   POST /api/admin/auctions/:auctionId/pause
// @desc    Pause auction
// @access  Private (Admin only)
router.post('/auctions/:auctionId/pause', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    if (auction.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: 'Only live auctions can be paused'
      });
    }

    auction.status = 'paused';
    await auction.save();

    // Broadcast pause event via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      const roomName = `auction_${auction._id}`;
      io.to(roomName).emit('auction_paused', {
        auctionId: auction._id,
        message: 'Auction has been paused by admin',
        pausedAt: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Auction paused successfully',
      auction
    });
  } catch (error) {
    console.error('Pause auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error pausing auction',
      error: error.message
    });
  }
});

// @route   POST /api/admin/auctions/:auctionId/resume
// @desc    Resume paused auction
// @access  Private (Admin only)
router.post('/auctions/:auctionId/resume', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    if (auction.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Only paused auctions can be resumed'
      });
    }

    const now = new Date();
    if (now > auction.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Cannot resume auction. End time has passed.'
      });
    }

    auction.status = 'live';
    await auction.save();

    // Broadcast resume event via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      const roomName = `auction_${auction._id}`;
      io.to(roomName).emit('auction_resumed', {
        auctionId: auction._id,
        message: 'Auction has been resumed',
        resumedAt: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Auction resumed successfully',
      auction
    });
  } catch (error) {
    console.error('Resume auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resuming auction',
      error: error.message
    });
  }
});

// @route   GET /api/admin/auctions/:auctionId/suspicious-bids
// @desc    Detect suspicious bidding patterns in auction
// @access  Private (Admin only)
router.get('/auctions/:auctionId/suspicious-bids', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    const suspiciousActivity = await detectSuspiciousBids(req.params.auctionId);

    res.json({
      success: true,
      suspicious: suspiciousActivity.suspicious,
      patternCount: suspiciousActivity.patternCount,
      patterns: suspiciousActivity.patterns
    });
  } catch (error) {
    console.error('Detect suspicious bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Error detecting suspicious bids',
      error: error.message
    });
  }
});

// @route   GET /api/admin/auctions/:auctionId/export
// @desc    Export auction data (CSV/JSON)
// @access  Private (Admin only)
router.get('/auctions/:auctionId/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const auction = await Auction.findById(req.params.auctionId)
      .populate('propertyId', 'title basePrice')
      .populate('highestBidder', 'fullName email')
      .populate('winner.userId', 'fullName email')
      .lean();

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Get all bids
    const bids = await Bid.find({ auctionId: req.params.auctionId })
      .populate('userId', 'fullName email phoneNumber')
      .sort({ timestamp: 1 })
      .lean();

    const auctionData = {
      auction: {
        id: auction._id,
        property: auction.propertyId?.title || 'N/A',
        basePrice: auction.propertyId?.basePrice || 0,
        startingBid: auction.startingBid,
        currentBid: auction.currentBid,
        highestBidder: auction.highestBidder?.fullName || 'N/A',
        status: auction.status,
        startTime: auction.startTime,
        endTime: auction.endTime,
        actualEndTime: auction.actualEndTime,
        totalBids: auction.totalBids,
        winner: auction.winner?.userId?.fullName || 'N/A',
        winningBid: auction.winner?.winningBid || 'N/A'
      },
      bids: bids.map(bid => ({
        id: bid._id,
        user: bid.userId?.fullName || 'N/A',
        email: bid.userId?.email || 'N/A',
        amount: bid.bidAmount,
        previousBid: bid.previousBid,
        increment: bid.bidAmount - (bid.previousBid || 0),
        status: bid.status,
        timestamp: bid.timestamp,
        flagged: bid.flagged || false,
        flagReason: bid.flagReason || null
      })),
      summary: {
        totalBids: bids.length,
        uniqueBidders: new Set(bids.map(b => b.userId?._id.toString())).size,
        flaggedBids: bids.filter(b => b.flagged).length,
        highestBid: Math.max(...bids.map(b => b.bidAmount), 0),
        averageBid: bids.length > 0 ? bids.reduce((sum, b) => sum + b.bidAmount, 0) / bids.length : 0
      }
    };

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = ['Bid ID', 'User', 'Email', 'Amount (NPR)', 'Previous Bid', 'Increment', 'Status', 'Timestamp', 'Flagged'];
      const csvRows = bids.map(bid => [
        bid._id,
        bid.userId?.fullName || 'N/A',
        bid.userId?.email || 'N/A',
        bid.bidAmount,
        bid.previousBid || 'N/A',
        bid.bidAmount - (bid.previousBid || 0),
        bid.status,
        new Date(bid.timestamp).toISOString(),
        bid.flagged ? 'Yes' : 'No'
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="auction-${req.params.auctionId}-${Date.now()}.csv"`);
      res.send(csvContent);
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="auction-${req.params.auctionId}-${Date.now()}.json"`);
      res.json(auctionData);
    }
  } catch (error) {
    console.error('Export auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting auction data',
      error: error.message
    });
  }
});

// ========== ANALYTICS ==========

// @route   GET /api/admin/analytics
// @desc    Get analytics data
// @access  Private (Admin only)
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const [
      userGrowth,
      revenueStats,
      propertyStats,
      auctionStats
    ] = await Promise.all([
      // User growth
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Revenue stats
      Deposit.aggregate([
        { $match: { status: 'approved', createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Property stats
      Property.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]),
      // Auction stats
      Auction.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      analytics: {
        userGrowth,
        revenueStats,
        propertyStats,
        auctionStats
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
});

// ========== ACTIVITY LOGS ==========

// @route   GET /api/admin/logs
// @desc    Get activity logs (simplified version - can be enhanced)
// @access  Private (Admin only)
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, type, userId } = req.query;

    // This is a simplified version - in production, you'd have a dedicated ActivityLog model
    // For now, we'll return recent activities from various collections
    const logs = [];

    // Get recent user registrations
    const recentUsers = await User.find(userId ? { _id: userId } : {})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('fullName email createdAt')
      .lean();
    
    recentUsers.forEach(user => {
      logs.push({
        type: 'user_registration',
        userId: user._id,
        userName: user.fullName,
        description: `User ${user.fullName} registered`,
        timestamp: user.createdAt
      });
    });

    // Get recent deposits
    const recentDeposits = await Deposit.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'fullName')
      .lean();
    
    recentDeposits.forEach(deposit => {
      logs.push({
        type: 'deposit_submission',
        userId: deposit.userId._id,
        userName: deposit.userId.fullName,
        description: `Deposit of ${deposit.amount} NPR submitted`,
        timestamp: deposit.createdAt
      });
    });

    // Sort by timestamp and paginate
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const paginatedLogs = logs.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      logs: paginatedLogs,
      totalPages: Math.ceil(logs.length / limit),
      currentPage: parseInt(page),
      total: logs.length
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching logs',
      error: error.message
    });
  }
});

// ========== SETTINGS ==========

// @route   GET /api/admin/settings
// @desc    Get platform settings
// @access  Private (Admin only)
router.get('/settings', async (req, res) => {
  try {
    // In a production system, you'd have a Settings model
    // For now, return default settings
    res.json({
      success: true,
      settings: {
        defaultDepositAmount: 50000,
        platformName: 'AuctionNepal',
        contactEmail: 'admin@auctionnepal.com',
        contactPhone: '9800000000',
        auctionRules: ''
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/settings
// @desc    Update platform settings
// @access  Private (Admin only)
router.put('/settings', [
  body('defaultDepositAmount').optional().isNumeric(),
  body('platformName').optional().trim(),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional().trim(),
  body('auctionRules').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // In a production system, you'd save to a Settings model/database
    // For now, just return success
    const { defaultDepositAmount, platformName, contactEmail, contactPhone, auctionRules } = req.body;
    
    // TODO: Save settings to database (create Settings model if needed)
    console.log('Settings updated:', { defaultDepositAmount, platformName, contactEmail, contactPhone, auctionRules });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        defaultDepositAmount: defaultDepositAmount || 50000,
        platformName: platformName || 'AuctionNepal',
        contactEmail: contactEmail || 'admin@auctionnepal.com',
        contactPhone: contactPhone || '9800000000',
        auctionRules: auctionRules || ''
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings',
      error: error.message
    });
  }
});

module.exports = router;

