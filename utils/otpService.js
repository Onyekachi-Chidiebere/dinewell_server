// In-memory storage for OTPs
// In production, consider using Redis or a database
const otpStore = new Map();
const verifiedEmails = new Map(); // Store verified emails with expiration

// OTP expiration time: 10 minutes
const OTP_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds
// Verification token expiration: 15 minutes (allows time to reset password after OTP verification)
const VERIFICATION_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Generate a random 5-digit OTP
 * @returns {string} - 5-digit OTP
 */
function generateOTP() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

/**
 * Store OTP with expiration
 * @param {string} email - Email address
 * @param {string} otp - OTP code
 */
function storeOTP(email, otp) {
  const expiryTime = Date.now() + OTP_EXPIRY_TIME;
  otpStore.set(email.toLowerCase(), {
    otp,
    expiryTime,
    createdAt: Date.now(),
  });

  // Clean up expired OTPs periodically
  cleanupExpiredOTPs();
}

/**
 * Verify OTP for an email
 * @param {string} email - Email address
 * @param {string} otp - OTP code to verify
 * @returns {boolean} - True if OTP is valid, false otherwise
 */
function verifyOTP(email, otp) {
  const emailKey = email.toLowerCase();
  const storedData = otpStore.get(emailKey);

  if (!storedData) {
    console.log('No OTP found for this mail')
    return false; // No OTP found for this email
  }

  // Check if OTP has expired
  if (Date.now() > storedData.expiryTime) {
    console.log('OTP has expired')
    otpStore.delete(emailKey); // Remove expired OTP
    return false;
  }

  // Verify OTP matches
  if (storedData.otp !== otp) {
    console.log('OTP doesnt match')
    return false; // OTP doesn't match
  }

  // OTP is valid - remove it after verification (one-time use)
  otpStore.delete(emailKey);
  
  // Store verification token for password reset (expires in 15 minutes)
  const verificationExpiry = Date.now() + VERIFICATION_TOKEN_EXPIRY;
  verifiedEmails.set(emailKey, {
    verified: true,
    expiryTime: verificationExpiry,
    verifiedAt: Date.now()
  });
  
  console.log('OTP verification successful')
  return true;
}

/**
 * Check if OTP exists and is not expired (without consuming it)
 * @param {string} email - Email address
 * @returns {boolean} - True if valid OTP exists
 */
function hasValidOTP(email) {
  const emailKey = email.toLowerCase();
  const storedData = otpStore.get(emailKey);

  if (!storedData) {
    return false;
  }

  if (Date.now() > storedData.expiryTime) {
    otpStore.delete(emailKey);
    return false;
  }

  return true;
}

/**
 * Remove OTP for an email
 * @param {string} email - Email address
 */
function removeOTP(email) {
  otpStore.delete(email.toLowerCase());
}

/**
 * Check if email was verified (OTP was successfully verified)
 * @param {string} email - Email address
 * @returns {boolean} - True if email was verified and token is still valid
 */
function isEmailVerified(email) {
  const emailKey = email.toLowerCase();
  const verificationData = verifiedEmails.get(emailKey);

  if (!verificationData) {
    return false;
  }

  // Check if verification token has expired
  if (Date.now() > verificationData.expiryTime) {
    verifiedEmails.delete(emailKey);
    return false;
  }

  return true;
}

/**
 * Remove verification token (after password reset is complete)
 * @param {string} email - Email address
 */
function removeVerificationToken(email) {
  verifiedEmails.delete(email.toLowerCase());
}

/**
 * Clean up expired OTPs and verification tokens from storage
 */
function cleanupExpiredOTPs() {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiryTime) {
      otpStore.delete(email);
    }
  }
  for (const [email, data] of verifiedEmails.entries()) {
    if (now > data.expiryTime) {
      verifiedEmails.delete(email);
    }
  }
}

// Clean up expired OTPs every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  hasValidOTP,
  removeOTP,
  isEmailVerified,
  removeVerificationToken,
};
