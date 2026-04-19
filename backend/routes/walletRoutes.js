const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadSingle, handleUploadError } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

// @route   GET /api/wallet/balance
// @desc    Get user's wallet balance
// @access  Private
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance');
    
    res.json({
      success: true,
      balance: user.walletBalance || 0
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet balance',
      error: error.message
    });
  }
});

// @route   POST /api/wallet/topup
// @desc    Top up wallet (add money to wallet)
// @access  Private
router.post('/topup', [
  authMiddleware,
  uploadSingle,
  handleUploadError,
  body('amount').isNumeric().isFloat({ min: 100 }).withMessage('Minimum top-up amount is 100 NPR'),
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

    const { amount, paymentMethod, phoneNumber } = req.body;
    const topupAmount = Number(amount);

    // Upload payment proof to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file, 'auctionnepal/wallet-topups');

    // Get current user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create wallet transaction record (pending)
    user.walletTransactions.push({
      transactionType: 'topup',
      amount: topupAmount,
      description: `Wallet top-up via ${paymentMethod}`,
      status: 'pending',
      paymentProof: uploadResult.url,
      paymentMethod: paymentMethod,
      phoneNumber: phoneNumber,
      createdAt: new Date()
    });

    await user.save();

    try {
      const { createWalletTopUpSubmittedNotification } = require('../utils/notificationService');
      const amt = new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 0
      }).format(topupAmount);
      await createWalletTopUpSubmittedNotification(req.user._id, amt);
    } catch (e) {
      console.error('Wallet top-up submitted notification:', e);
    }

    res.json({
      success: true,
      message: 'Top-up request submitted successfully. Waiting for admin verification.',
      transaction: {
        amount: topupAmount,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Wallet top-up error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing top-up',
      error: error.message
    });
  }
});

// @route   GET /api/wallet/transactions
// @desc    Get user's wallet transactions
// @access  Private
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('walletTransactions walletBalance')
      .lean();

    // Sort transactions by date (newest first)
    const transactions = (user.walletTransactions || []).sort((a, b) => {
      return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
    });

    res.json({
      success: true,
      transactions: transactions,
      currentBalance: user.walletBalance || 0
    });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet transactions',
      error: error.message
    });
  }
});

// @route   POST /api/wallet/use-for-deposit
// @desc    Use wallet balance for auction deposit
// @access  Private
router.post('/use-for-deposit', [
  authMiddleware,
  body('propertyId').notEmpty().withMessage('Property ID is required'),
  body('auctionId').notEmpty().withMessage('Auction ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number')
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

    const { propertyId, auctionId, amount } = req.body;
    const depositAmount = Number(amount);

    const Deposit = require('../models/Deposit');
    const Property = require('../models/Property');
    const Auction = require('../models/Auction');

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (depositAmount !== property.depositAmount) {
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

    const { evaluateDepositWindow } = require('../utils/depositWindowPolicy');
    const depositWindow = evaluateDepositWindow(auction, property);
    if (!depositWindow.allowed) {
      return res.status(400).json({
        success: false,
        code: depositWindow.reason,
        message: depositWindow.message
      });
    }

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

    // Get user with wallet balance
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const balanceNum = Number(user.walletBalance) || 0;
    if (balanceNum < depositAmount) {
      const fmt = (n) =>
        new Intl.NumberFormat('en-NP', {
          style: 'currency',
          currency: 'NPR',
          minimumFractionDigits: 0
        }).format(n);
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_WALLET',
        message: `Insufficient wallet balance. You have ${fmt(balanceNum)} but ${fmt(depositAmount)} is required to pay this deposit. Top up your wallet or use QR payment instead.`
      });
    }

    user.walletBalance -= depositAmount;

    user.walletTransactions.push({
      transactionType: 'deposit',
      amount: -depositAmount,
      description: `Deposit for auction ${auctionId}`,
      relatedId: auctionId,
      status: 'approved',
      createdAt: new Date()
    });

    await user.save();

    const deposit = new Deposit({
      userId: req.user._id,
      propertyId: propertyId,
      auctionId: auctionId,
      amount: depositAmount,
      paymentMethod: 'wallet',
      phoneNumber: user.phoneNumber,
      paymentProof: {
        url: 'wallet_balance',
        uploadedAt: new Date()
      },
      status: 'approved', // Auto-approved since using wallet balance
      verifiedBy: req.user._id, // Self-verified
      verifiedAt: new Date()
    });

    await deposit.save();

    try {
      const { createDepositWalletPaidNotification } = require('../utils/notificationService');
      const amt = new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 0
      }).format(depositAmount);
      await createDepositWalletPaidNotification(req.user._id, property.title || 'Property', amt);
    } catch (e) {
      console.error('Wallet deposit notification:', e);
    }

    res.json({
      success: true,
      message: 'Deposit paid successfully from wallet balance.',
      deposit: {
        id: deposit._id,
        status: deposit.status,
        amount: deposit.amount
      },
      newBalance: user.walletBalance
    });
  } catch (error) {
    console.error('Use wallet for deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error using wallet for deposit',
      error: error.message
    });
  }
});

module.exports = router;

