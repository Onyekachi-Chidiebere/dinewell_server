// In-memory storage for OTPs
// In production, consider using Redis or a database
const otpStore = new Map();

// OTP expiration time: 10 minutes
const OTP_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

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
    return false; // No OTP found for this email
  }

  // Check if OTP has expired
  if (Date.now() > storedData.expiryTime) {
    otpStore.delete(emailKey); // Remove expired OTP
    return false;
  }

  // Verify OTP matches
  if (storedData.otp !== otp) {
    return false; // OTP doesn't match
  }

  // OTP is valid - remove it after verification (one-time use)
  otpStore.delete(emailKey);
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
 * Clean up expired OTPs from storage
 */
function cleanupExpiredOTPs() {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiryTime) {
      otpStore.delete(email);
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
};
