const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Deposit = require('../models/Deposit');
const Property = require('../models/Property');
const Auction = require('../models/Auction');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadSingle, handleUploadError } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { evaluateDepositWindow } = require('../utils/depositWindowPolicy');

// @route   POST /api/deposits/submit
// @desc    Submit deposit payment
// @access  Private
router.post('/submit', [
  authMiddleware,
  uploadSingle,
  handleUploadError,
  body('propertyId').notEmpty().withMessage('Property ID is required'),
  body('auctionId').notEmpty().withMessage('Auction ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('paymentMethod').isIn(['khalti', 'esewa']).withMessage('Payment method must be khalti or esewa'),
  body('phoneNumber').matches(/^[0-9]{10}$/).withMessage('Phone number must be 10 digits'),
  body('agreedToTerms').equals('true').withMessage('You must agree to the terms and conditions')
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Payment proof screenshot is required'
      });
    }

    const { propertyId, auctionId, amount, paymentMethod, phoneNumber } = req.body;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Verify deposit amount matches property deposit amount
    if (Number(amount) !== property.depositAmount) {
      return res.status(400).json({
        success: false,
        message: `Deposit amount must be exactly ${property.depositAmount} NPR`
      });
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }
    if (auction.propertyId.toString() !== String(propertyId)) {
      return res.status(400).json({
        success: false,
        message: 'Auction does not match this property'
      });
    }
    if (auction.status === 'completed' || auction.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This auction is no longer accepting deposits'
      });
    }
    if (new Date() > new Date(auction.endTime)) {
      return res.status(400).json({
        success: false,
        message: 'This auction has ended; deposits are not accepted'
      });
    }

    const depositWindow = evaluateDepositWindow(auction, property);
    if (!depositWindow.allowed) {
      return res.status(400).json({
        success: false,
        code: depositWindow.reason,
        message: depositWindow.message
      });
    }

    // Check if user already has a deposit for this auction
    const existingDeposit = await Deposit.findOne({
      userId: req.user._id,
      auctionId: auctionId
    });

    if (existingDeposit) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a deposit for this auction'
      });
    }

    // Upload payment proof to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file, 'auctionnepal/deposits');

    // Create deposit record
    const deposit = new Deposit({
      userId: req.user._id,
      propertyId: propertyId,
      auctionId: auctionId,
      amount: Number(amount),
      paymentMethod: paymentMethod,
      phoneNumber: phoneNumber,
      paymentProof: {
        url: uploadResult.url,
        uploadedAt: new Date()
      },
      status: 'pending'
    });

    await deposit.save();

    try {
      const prop = await Property.findById(propertyId).select('title').lean();
      const title = prop?.title || 'Property';
      const amt = new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 0
      }).format(Number(amount));
      const { createDepositSubmittedNotification } = require('../utils/notificationService');
      await createDepositSubmittedNotification(req.user._id, title, amt);
    } catch (e) {
      console.error('Deposit submitted notification:', e);
    }

    // Update user's deposit status
    await User.findByIdAndUpdate(req.user._id, {
      depositEligible: false, // Set to false until approved
      'depositData.amount': Number(amount),
      'depositData.paymentProof': uploadResult.url,
      'depositData.status': 'pending'
    });

    res.json({
      success: true,
      message: 'Deposit submitted successfully. Waiting for admin verification.',
      deposit: {
        id: deposit._id,
        status: deposit.status,
        amount: deposit.amount
      }
    });
  } catch (error) {
    console.error('Submit deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting deposit',
      error: error.message
    });
  }
});

// @route   GET /api/deposits/my-deposits
// @desc    Get current user's deposits
// @access  Private
router.get('/my-deposits', authMiddleware, async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user._id })
      .populate('propertyId', 'title location basePrice auctionTime')
      .populate('auctionId', 'status')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate total approved deposits (wallet balance)
    const totalApproved = deposits
      .filter(d => d.status === 'approved' || d.status === 'verified')
      .reduce((sum, d) => sum + (d.amount || 0), 0);

    res.json({
      success: true,
      deposits: deposits,
      totalApproved: totalApproved,
      totalPending: deposits.filter(d => d.status === 'pending').reduce((sum, d) => sum + (d.amount || 0), 0),
      totalRejected: deposits.filter(d => d.status === 'rejected').reduce((sum, d) => sum + (d.amount || 0), 0)
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

// @route   GET /api/deposits/balance
// @desc    Get user's total deposit balance (wallet)
// @access  Private
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user._id }).lean();

    const balance = {
      totalApproved: deposits
        .filter(d => d.status === 'approved' || d.status === 'verified')
        .reduce((sum, d) => sum + (d.amount || 0), 0),
      totalPending: deposits
        .filter(d => d.status === 'pending')
        .reduce((sum, d) => sum + (d.amount || 0), 0),
      totalRejected: deposits
        .filter(d => d.status === 'rejected')
        .reduce((sum, d) => sum + (d.amount || 0), 0),
      totalRefunded: deposits
        .filter(d => d.status === 'refunded')
        .reduce((sum, d) => sum + (d.amount || 0), 0),
      totalDeposits: deposits.length,
      approvedDeposits: deposits.filter(d => d.status === 'approved' || d.status === 'verified').length
    };

    res.json({
      success: true,
      balance: balance
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balance',
      error: error.message
    });
  }
});

// @route   GET /api/deposits/check/:propertyId
// @desc    Check if user has deposit for a property/auction
// @access  Private
router.get('/check/:propertyId', authMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId).lean();
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const auction = await Auction.findOne({ propertyId: property._id })
      .sort({ startTime: -1 })
      .lean();

    const depositWindow = evaluateDepositWindow(auction, property);

    // Find deposit for this user and property
    const deposit = await Deposit.findOne({
      userId: req.user._id,
      propertyId: req.params.propertyId
    })
      .populate('propertyId', 'title depositAmount')
      .lean();

    res.json({
      success: true,
      hasDeposit: !!deposit,
      deposit: deposit || null,
      requiredAmount: property.depositAmount,
      depositsAllowed: depositWindow.allowed,
      depositsClosedReason: depositWindow.reason || null,
      depositsClosedMessage: depositWindow.message || null,
      auctionStart: depositWindow.auctionStart ? depositWindow.auctionStart.toISOString() : null
    });
  } catch (error) {
    console.error('Check deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking deposit',
      error: error.message
    });
  }
});

// @route   GET /api/deposits/qr-codes
// @desc    Get admin's payment QR codes
// @access  Public (or can be protected)
router.get('/qr-codes', async (req, res) => {
  try {
    // Use personal QR code from frontend public folder
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const qrCodes = {
      khalti: process.env.KHALTI_QR_CODE_URL || '/images/khalti-qr-placeholder.png',
      esewa: '/my esewa qr.jpeg', // Personal eSewa QR code from public folder
      khaltiAccount: process.env.KHALTI_ACCOUNT_NAME || process.env.KHALTI_PHONE || 'AuctionNepal',
      esewaAccount: 'Saskrit Bhattarai',
      esewaPhone: '9703649841',
      instructions: {
        khalti: '1. Open Khalti app\n2. Scan the QR code or enter account name/phone\n3. Enter the deposit amount\n4. Complete payment\n5. Take a screenshot of the payment confirmation',
        esewa: '1. Open eSewa app\n2. Scan the QR code below\n3. Enter the deposit amount shown above\n4. Complete payment\n5. Take a screenshot of the payment confirmation'
      }
    };

    res.json({
      success: true,
      qrCodes: qrCodes
    });
  } catch (error) {
    console.error('Get QR codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching QR codes',
      error: error.message
    });
  }
});

module.exports = router;

