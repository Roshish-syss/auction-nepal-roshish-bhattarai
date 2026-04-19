const { body } = require('express-validator');

const MIN_PASSWORD_LENGTH = 8;

/**
 * Express-validator chain for strong passwords (matches frontend passwordRules).
 * @param {string} fieldName - e.g. 'password' or 'newPassword'
 */
function passwordField(fieldName = 'password') {
  return body(fieldName)
    .isLength({ min: MIN_PASSWORD_LENGTH })
    .withMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .matches(/[A-Z]/)
    .withMessage('Password must include at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must include at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must include at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must include at least one special character');
}

module.exports = {
  passwordField,
  MIN_PASSWORD_LENGTH,
};
