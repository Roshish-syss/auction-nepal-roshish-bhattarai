const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { passwordField } = require('../utils/passwordValidators');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendPasswordResetConfirmation } = require('../utils/emailService');
const { JWT_SECRET, JWT_REFRESH_SECRET } = require('../config/jwtSecrets');

/** Map Mongo E11000 to a user-facing message (keyValue shape differs by driver / Atlas). */
function messageForDuplicateKey(error) {
  const kv = error.keyValue || error.errInfo?.keyValue || {};
  const kp = error.keyPattern || {};
  const raw = String(error.message || '');

  const dupMatch = raw.match(/dup key:\s*\{([^}]*)\}/i);
  if (dupMatch) {
    const inner = dupMatch[1];
    if (/\bemail\s*:/i.test(inner)) return 'Email already registered';
    if (/\bphoneNumber\s*:/i.test(inner)) return 'Phone number already registered';
  }

  if (kv.email != null && kv.email !== '') return 'Email already registered';
  if (kv.phoneNumber != null && kv.phoneNumber !== '') return 'Phone number already registered';
  if (kp.email != null) return 'Email already registered';
  if (kp.phoneNumber != null) return 'Phone number already registered';

  if (/index:[^\n]*email/i.test(raw)) return 'Email already registered';
  if (/index:[^\n]*phoneNumber/i.test(raw)) return 'Phone number already registered';

  return 'Could not create this account (duplicate data). Try a different email or phone number, or sign in.';
}

/** Root-level phone only — avoids matching walletTransactions[].phoneNumber (same key name). */
function rootPhoneEquals(phoneDigits) {
  return {
    $expr: {
      $eq: [
        {
          $convert: {
            input: { $getField: { field: 'phoneNumber', input: '$$ROOT' } },
            to: 'string',
            onError: '',
            onNull: ''
          }
        },
        phoneDigits
      ]
    }
  };
}

/** Prefer root-only phone match; fall back if MongoDB is too old for $getField on $$ROOT. */
async function existsRootPhone(phoneDigits) {
  try {
    return await User.exists(rootPhoneEquals(phoneDigits));
  } catch (err) {
    console.warn('existsRootPhone fallback:', err.message);
    return await User.exists({ phoneNumber: phoneDigits });
  }
}

// Generate JWT Access Token
const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' }); // Short-lived access token
};

// Generate JWT Refresh Token
const generateRefreshToken = (userId, rememberMe = false) => {
  // If remember me is checked, token expires in 30 days, otherwise 7 days
  const expiresIn = rememberMe ? '30d' : '7d';
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  // Do not use normalizeEmail() — it can merge Gmail variants and cause false "already registered" vs DB.
  body('email').trim().isEmail().withMessage('Please enter a valid email'),
  // JSON may send phone as a number; coerce to digits-only string before length check
  body('phoneNumber')
    .customSanitizer((v) => String(v ?? '').replace(/\D/g, ''))
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  passwordField('password'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const arr = errors.array({ onlyFirstError: false });
      const primary = arr[0]?.msg || 'Please check the form and try again.';
      return res.status(400).json({
        success: false,
        message: primary,
        errors: arr
      });
    }

    const { fullName, password } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    const phoneNumber = String(req.body.phoneNumber || '').replace(/\D/g, '');

    // Email: case-insensitive vs stored values. Phone: ONLY root phoneNumber ($getField + $$ROOT),
    // never walletTransactions[].phoneNumber (wallet top-ups store the same field name there).
    const emailTaken = await User.exists({
      $expr: { $eq: [{ $toLower: '$email' }, email] }
    });
    const phoneTaken = await existsRootPhone(phoneNumber);

    if (emailTaken && phoneTaken) {
      return res.status(400).json({
        success: false,
        message: 'Email and phone number are already registered'
      });
    }
    if (emailTaken) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    if (phoneTaken) {
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    // Create new user
    const user = new User({
      fullName,
      email,
      phoneNumber,
      password
    });

    await user.save();

    try {
      const { createWelcomeNotification } = require('../utils/notificationService');
      await createWelcomeNotification(user._id);
    } catch (notifErr) {
      console.error('Welcome notification:', notifErr);
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      const emailNorm = String(req.body.email || '').trim().toLowerCase();
      const phoneDigits = String(req.body.phoneNumber || '').replace(/\D/g, '');
      try {
        const emailTaken = await User.exists({
          $expr: { $eq: [{ $toLower: '$email' }, emailNorm] }
        });
        const phoneTaken = await existsRootPhone(phoneDigits);
        if (emailTaken && phoneTaken) {
          return res.status(400).json({
            success: false,
            message: 'Email and phone number are already registered'
          });
        }
        if (emailTaken) {
          return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        if (phoneTaken) {
          return res.status(400).json({ success: false, message: 'Phone number already registered' });
        }
      } catch (lookupErr) {
        console.error('Duplicate-key follow-up lookup:', lookupErr);
      }
      return res.status(400).json({
        success: false,
        message: messageForDuplicateKey(error)
      });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors || {}).map((e) => ({
        path: e.path,
        msg: e.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  // Do not use normalizeEmail() — it can merge Gmail variants and cause false "already registered" vs DB.
  body('email').trim().isEmail().withMessage('Email does not exist.'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const arr = errors.array({ onlyFirstError: false });
      return res.status(400).json({
        success: false,
        message: arr[0]?.msg || 'Please check the form and try again.',
        errors: arr
      });
    }

    const { password, rememberMe } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    // Find user by email (root field only; same $expr pattern avoids path ambiguity)
    const user = await User.findOne({
      $expr: { $eq: [{ $toLower: '$email' }, email] }
    });
    
    if (!user) {
      const msg = 'Email does not exist.';
      return res.status(401).json({
        success: false,
        message: msg,
        errors: [{ path: 'email', msg }]
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      const msg = 'The password you entered is incorrect.';
      return res.status(401).json({
        success: false,
        message: msg,
        errors: [{ path: 'password', msg }]
      });
    }

    // Generate tokens with remember me option
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id, rememberMe === true);

    // Save refresh token to user with appropriate expiration
    const expirationDays = rememberMe ? 30 : 7;
    user.refreshToken = refreshToken;
    user.refreshTokenExpires = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        kycVerified: user.kycVerified,
        depositEligible: user.depositEligible
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh access token using refresh token
// @access  Public
router.post('/refresh-token', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
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

    const { refreshToken } = req.body;

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Find user and verify refresh token matches
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Check if refresh token is expired
    if (user.refreshTokenExpires && user.refreshTokenExpires < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has expired'
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id);

    res.json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please enter a valid email')
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

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save reset token to user
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Create reset URL (first origin if FRONTEND_URL is comma-separated)
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
    const resetUrl = `${frontendBase}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send email
    const emailResult = await sendPasswordResetEmail(email, resetToken, resetUrl);

    if (!emailResult.success) {
      // Reset token if email fails
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();

      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email'
      });
    }

    res.json({
      success: true,
      message: 'If that email exists, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  passwordField('password'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
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

    const { token, email, password } = req.body;

    // Hash the token
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      email: email.toLowerCase(),
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    // Invalidate all refresh tokens for security
    user.refreshToken = null;
    user.refreshTokenExpires = null;
    await user.save();

    // Send confirmation email
    await sendPasswordResetConfirmation(email);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user and invalidate refresh token
// @access  Private
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Find user with this refresh token and invalidate it
      const user = await User.findOne({ refreshToken });
      if (user) {
        user.refreshToken = null;
        user.refreshTokenExpires = null;
        await user.save();
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success even if there's an error
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

module.exports = router;

