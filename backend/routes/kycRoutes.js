const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const KYC = require('../models/KYC');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadSingle, handleUploadError } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { generateOTP, getOTPExpiration, verifyOTP } = require('../utils/otpService');
const { sendKYCOTPEmail } = require('../utils/emailService');
const { generateSecretCode, generateAuctionGroupLink } = require('../utils/secretCodeService');

// Admin middleware (check if user is admin)
const adminMiddleware = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  next();
};

// @route   POST /api/kyc/upload-document
// @desc    Upload citizenship photo for KYC
// @access  Private
router.post('/upload-document', authMiddleware, uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a citizenship photo'
      });
    }

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed'
      });
    }

    // Check if user already has a KYC record
    let kyc = await KYC.findOne({ userId: req.user._id });

    if (kyc && kyc.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'KYC already approved. Cannot upload new document.'
      });
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file, 'auctionnepal/kyc/citizenship');

    // Create or update KYC record
    if (!kyc) {
      kyc = new KYC({
        userId: req.user._id,
        email: req.user.email,
        citizenshipPhoto: {
          url: uploadResult.url,
          uploadedAt: new Date()
        }
      });
    } else {
      kyc.citizenshipPhoto = {
        url: uploadResult.url,
        uploadedAt: new Date()
      };
      kyc.status = kyc.emailVerified ? 'document_uploaded' : 'pending';
    }

    await kyc.save();

    try {
      const { createKycDocumentUploadedNotification } = require('../utils/notificationService');
      await createKycDocumentUploadedNotification(req.user._id, kyc._id);
    } catch (notifErr) {
      console.error('KYC upload notification:', notifErr);
    }

    res.json({
      success: true,
      message: 'Citizenship photo uploaded successfully',
      kyc: {
        status: kyc.status,
        documentUploaded: true
      }
    });
  } catch (error) {
    console.error('KYC upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading document',
      error: error.message
    });
  }
});

// @route   POST /api/kyc/send-otp
// @desc    Send OTP to user's email address
// @access  Private
router.post('/send-otp', [
  authMiddleware,
  body('email').isEmail().withMessage('Please enter a valid email address')
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

    const { email } = req.body;
    const userEmail = email.toLowerCase().trim();

    // Generate OTP
    const otp = generateOTP();
    const otpExpiresAt = getOTPExpiration();

    // Find or create KYC record
    let kyc = await KYC.findOne({ userId: req.user._id });

    // Rate limiting: Check if user sent OTP recently (max 1 per minute)
    if (kyc && kyc.lastVerificationAttempt) {
      const timeSinceLastAttempt = Date.now() - new Date(kyc.lastVerificationAttempt).getTime();
      if (timeSinceLastAttempt < 60000) { // 1 minute
        return res.status(429).json({
          success: false,
          message: 'Please wait before requesting another OTP'
        });
      }
    }

    if (!kyc) {
      kyc = new KYC({
        userId: req.user._id,
        email: userEmail
      });
    } else {
      kyc.email = userEmail;
    }

    // Store OTP
    kyc.otpCode = otp;
    kyc.otpExpiresAt = otpExpiresAt;
    kyc.verificationAttempts += 1;
    kyc.lastVerificationAttempt = new Date();
    await kyc.save();

    // Send OTP via Email
    const emailResult = await sendKYCOTPEmail(userEmail, otp);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'OTP sent to your email address',
      // In development, return OTP for testing (remove in production)
      ...(process.env.NODE_ENV === 'development' && { otp: otp })
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message
    });
  }
});

// @route   POST /api/kyc/verify-otp
// @desc    Verify OTP code
// @access  Private
router.post('/verify-otp', [
  authMiddleware,
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('email').isEmail().withMessage('Please enter a valid email address')
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

    const { otp, email } = req.body;
    const userEmail = email.toLowerCase().trim();

    // Find KYC record
    const kyc = await KYC.findOne({ userId: req.user._id });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found. Please send OTP first.'
      });
    }

    if (kyc.email !== userEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email address mismatch'
      });
    }

    // Verify OTP
    const verification = verifyOTP(kyc.otpCode, otp, kyc.otpExpiresAt);

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // Mark email as verified
    kyc.emailVerified = true;
    kyc.otpVerifiedAt = new Date();
    kyc.otpCode = null; // Clear OTP after verification
    kyc.otpExpiresAt = null;

    // Update status
    if (kyc.citizenshipPhoto && kyc.citizenshipPhoto.url) {
      kyc.status = 'document_uploaded';
    } else {
      kyc.status = 'email_verified';
    }

    await kyc.save();

    // Update user's email verified status
    await User.findByIdAndUpdate(req.user._id, {
      'kycData.emailVerified': true
    });

    res.json({
      success: true,
      message: 'Email address verified successfully',
      kyc: {
        emailVerified: true,
        status: kyc.status
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: error.message
    });
  }
});

// @route   GET /api/kyc/status
// @desc    Get current user's KYC status
// @access  Private
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const kyc = await KYC.findOne({ userId: req.user._id });

    if (!kyc) {
      return res.json({
        success: true,
        kyc: {
          status: 'pending',
          emailVerified: false,
          documentUploaded: false,
          adminApproved: false
        }
      });
    }

    res.json({
      success: true,
        kyc: {
          status: kyc.status,
          emailVerified: kyc.emailVerified,
          documentUploaded: !!kyc.citizenshipPhoto?.url,
          adminApproved: kyc.adminApproved,
          rejectionReason: kyc.rejectionReason,
          citizenshipNumber: kyc.citizenshipNumber || null
        }
    });
  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC status',
      error: error.message
    });
  }
});

// @route   POST /api/kyc/citizenship-number
// @desc    Add citizenship number (required)
// @access  Private
router.post('/citizenship-number', [
  authMiddleware,
  body('citizenshipNumber').trim().notEmpty().withMessage('Citizenship number is required').isLength({ min: 1 }).withMessage('Citizenship number cannot be empty')
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

    const { citizenshipNumber } = req.body;
    let kyc = await KYC.findOne({ userId: req.user._id });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found'
      });
    }

    kyc.citizenshipNumber = citizenshipNumber.trim();
    
    // Update status to under_review if email is verified and document is uploaded
    if (kyc.emailVerified && kyc.citizenshipPhoto?.url && kyc.status !== 'approved' && kyc.status !== 'rejected') {
      kyc.status = 'under_review';
    }
    
    await kyc.save();

    res.json({
      success: true,
      message: 'Citizenship number added successfully',
      kyc: {
        citizenshipNumber: kyc.citizenshipNumber,
        status: kyc.status
      }
    });
  } catch (error) {
    console.error('Add citizenship number error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding citizenship number',
      error: error.message
    });
  }
});

// ========== ADMIN ROUTES ==========

// @route   GET /api/kyc/admin/pending
// @desc    Get all pending KYC verifications
// @access  Private (Admin only)
router.get('/admin/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pendingKYCs = await KYC.find({
      status: { $in: ['document_uploaded', 'under_review'] }
    })
      .populate('userId', 'fullName email phoneNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingKYCs.length,
      kycs: pendingKYCs
    });
  } catch (error) {
    console.error('Get pending KYCs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending KYCs',
      error: error.message
    });
  }
});

// @route   GET /api/kyc/admin/all
// @desc    Get all KYC records
// @access  Private (Admin only)
router.get('/admin/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const kycs = await KYC.find(query)
      .populate('userId', 'fullName email phoneNumber')
      .populate('approvedBy', 'fullName')
      .populate('rejectedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await KYC.countDocuments(query);

    res.json({
      success: true,
      kycs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get all KYCs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYCs',
      error: error.message
    });
  }
});

// @route   GET /api/kyc/admin/:kycId
// @desc    Get single KYC record by ID
// @access  Private (Admin only)
router.get('/admin/:kycId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.kycId)
      .populate('userId', 'fullName email phoneNumber createdAt')
      .populate('approvedBy', 'fullName')
      .populate('rejectedBy', 'fullName');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found'
      });
    }

    res.json({
      success: true,
      kyc
    });
  } catch (error) {
    console.error('Get KYC error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC',
      error: error.message
    });
  }
});

// @route   POST /api/kyc/admin/approve/:kycId
// @desc    Approve KYC verification
// @access  Private (Admin only)
router.post('/admin/approve/:kycId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.kycId);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found'
      });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'KYC already approved'
      });
    }

    // Generate unique secret code and auction group link
    const secretCode = generateSecretCode();
    const auctionGroupLink = generateAuctionGroupLink(kyc._id, secretCode);

    // Update KYC status
    kyc.status = 'approved';
    kyc.adminApproved = true;
    kyc.approvedBy = req.user._id;
    kyc.approvedAt = new Date();
    await kyc.save();

    // Update user's KYC status and assign secret code
    const user = await User.findById(kyc.userId);
    user.kycVerified = true;
    user.kycData.adminApproved = true;
    user.secretCode = secretCode;
    user.auctionGroupLink = auctionGroupLink;
    await user.save();

    // Create notification
    try {
      const { createKYCApprovedNotification } = require('../utils/notificationService');
      await createKYCApprovedNotification(kyc.userId, kyc._id);
    } catch (notifError) {
      console.error('Error creating KYC approved notification:', notifError);
      // Don't fail the request if notification creation fails
    }

    res.json({
      success: true,
      message: 'KYC approved successfully',
      kyc: {
        id: kyc._id,
        status: kyc.status,
        approvedAt: kyc.approvedAt
      }
    });
  } catch (error) {
    console.error('Approve KYC error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving KYC',
      error: error.message
    });
  }
});

// @route   POST /api/kyc/admin/reject/:kycId
// @desc    Reject KYC verification
// @access  Private (Admin only)
router.post('/admin/reject/:kycId', [
  authMiddleware,
  adminMiddleware,
  body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required')
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

    const { rejectionReason } = req.body;
    const kyc = await KYC.findById(req.params.kycId);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found'
      });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an already approved KYC'
      });
    }

    // Update KYC status
    kyc.status = 'rejected';
    kyc.adminApproved = false;
    kyc.rejectionReason = rejectionReason;
    kyc.rejectedBy = req.user._id;
    kyc.rejectedAt = new Date();
    await kyc.save();

    // Update user's KYC status
    await User.findByIdAndUpdate(kyc.userId, {
      kycVerified: false,
      'kycData.adminApproved': false
    });

    // Create notification
    try {
      const { createKYCRejectedNotification } = require('../utils/notificationService');
      await createKYCRejectedNotification(kyc.userId, kyc._id, rejectionReason);
    } catch (notifError) {
      console.error('Error creating KYC rejected notification:', notifError);
      // Don't fail the request if notification creation fails
    }

    res.json({
      success: true,
      message: 'KYC rejected successfully',
      kyc: {
        id: kyc._id,
        status: kyc.status,
        rejectedAt: kyc.rejectedAt
      }
    });
  } catch (error) {
    console.error('Reject KYC error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting KYC',
      error: error.message
    });
  }
});

module.exports = router;

