const crypto = require('crypto');

// Generate 6-digit OTP
exports.generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Generate OTP expiration time (5 minutes from now)
exports.getOTPExpiration = () => {
  return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
};

// Verify OTP
exports.verifyOTP = (storedOTP, providedOTP, expirationTime) => {
  // Check if OTP has expired
  if (new Date() > expirationTime) {
    return { valid: false, message: 'OTP has expired' };
  }

  // Check if OTP matches
  if (storedOTP !== providedOTP) {
    return { valid: false, message: 'Invalid OTP' };
  }

  return { valid: true, message: 'OTP verified successfully' };
};

