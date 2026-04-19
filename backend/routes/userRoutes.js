const express = require('express');
const { passwordField } = require('../utils/passwordValidators');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadSingle, handleUploadError } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -passwordResetToken -refreshToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  authMiddleware,
  body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
  body('phoneNumber').optional().matches(/^[0-9]{10}$/).withMessage('Phone number must be 10 digits'),
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

    const { fullName, phoneNumber, agreedToTerms, agreedToTermsAt } = req.body;
    const updates = {};

    if (fullName) updates.fullName = fullName;
    if (phoneNumber) {
      // Check if phone number is already taken by another user
      const existingUser = await User.findOne({ 
        phoneNumber,
        _id: { $ne: req.user._id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered'
        });
      }
      updates.phoneNumber = phoneNumber;
    }
    if (agreedToTerms !== undefined) {
      updates.agreedToTerms = agreedToTerms;
      if (agreedToTerms && agreedToTermsAt) {
        updates.agreedToTermsAt = agreedToTermsAt;
        updates.termsVersion = '1.0'; // Current version
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -refreshToken');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/users/upload-profile-picture
// @desc    Upload or update user profile picture
// @access  Private
router.post('/upload-profile-picture', [
  authMiddleware,
  uploadSingle,
  handleUploadError
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed'
      });
    }

    const user = await User.findById(req.user._id);

    // Delete old profile picture from Cloudinary if exists
    if (user.profilePicture && user.profilePicture.public_id) {
      try {
        await deleteFromCloudinary(user.profilePicture.public_id);
      } catch (error) {
        console.error('Error deleting old profile picture:', error);
        // Continue even if deletion fails
      }
    }

    // Upload new profile picture to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file, 'auctionnepal/profile-pictures');

    // Update user's profile picture
    user.profilePicture = {
      url: uploadResult.url,
      public_id: uploadResult.public_id,
      uploadedAt: new Date()
    };

    await user.save();

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: {
        url: user.profilePicture.url,
        uploadedAt: user.profilePicture.uploadedAt
      }
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading profile picture',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/delete-profile-picture
// @desc    Delete user profile picture
// @access  Private
router.delete('/delete-profile-picture', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.profilePicture || !user.profilePicture.public_id) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture to delete'
      });
    }

    // Delete from Cloudinary
    try {
      await deleteFromCloudinary(user.profilePicture.public_id);
    } catch (error) {
      console.error('Error deleting profile picture from Cloudinary:', error);
    }

    // Remove profile picture from user
    user.profilePicture = {
      url: null,
      public_id: null,
      uploadedAt: null
    };

    await user.save();

    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting profile picture',
      error: error.message
    });
  }
});

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', [
  authMiddleware,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordField('newPassword'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
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

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

