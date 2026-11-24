const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const OtpChallenge = require('../models/otpChallenge');
const { hash } = require('../services/authService');
const { sequelize } = require('./db-connection');

const OTP_EXPIRY_TIME = 10 * 60 * 1000;
const RESET_EXPIRY_TIME = 15 * 60 * 1000;
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

/**
 * Generate a random 5-digit OTP
 * @returns {string} - 5-digit OTP
 */
function generateOTP() {
  return crypto.randomInt(10000, 100000).toString();
}

/**
 * Store OTP with expiration
 * @param {string} email - Email address
 * @param {string} otp - OTP code
 */
async function storeOTP(email, otp, { userId, accountType }) {
  await OtpChallenge.destroy({
    where: { email: email.toLowerCase(), account_type: accountType, purpose: 'password_reset' },
  });
  return OtpChallenge.create({
    id: uuidv4(),
    user_id: userId,
    email: email.toLowerCase(),
    account_type: accountType,
    otp_hash: hash(otp),
    expires_at: new Date(Date.now() + OTP_EXPIRY_TIME),
  });
}

/**
 * Verify OTP for an email
 * @param {string} email - Email address
 * @param {string} otp - OTP code to verify
 * @returns {boolean} - True if OTP is valid, false otherwise
 */
async function verifyOTP(email, otp, accountType) {
  const challenge = await OtpChallenge.findOne({
    where: {
      email: email.toLowerCase(),
      account_type: accountType,
      purpose: 'password_reset',
      consumed_at: null,
    },
    order: [['created_at', 'DESC']],
  });
  if (!challenge || challenge.expires_at <= new Date() || challenge.attempts >= MAX_ATTEMPTS) return null;
  if (challenge.otp_hash !== hash(String(otp))) {
    await challenge.increment('attempts');
    return null;
  }
  const jti = uuidv4();
  const resetToken = jwt.sign({
    sub: String(challenge.user_id),
    email: challenge.email,
    type: challenge.account_type,
    tokenType: 'password-reset',
    jti,
  }, process.env.RESET_TOKEN_SECRET || process.env.JSON_WEB_SECRET, {
    expiresIn: '15m',
    issuer: 'dinewell',
  });
  await challenge.update({ consumed_at: new Date(), reset_jti_hash: hash(jti) });
  return { resetToken, userId: challenge.user_id, email: challenge.email };
}

/**
 * Check if OTP exists and is not expired (without consuming it)
 * @param {string} email - Email address
 * @returns {boolean} - True if valid OTP exists
 */
async function consumeResetToken(resetToken, expectedType) {
  const decoded = decodeResetToken(resetToken, expectedType);
  if (!decoded) return null;
  return sequelize.transaction(async (transaction) => {
    const challenge = await OtpChallenge.findOne({
      where: {
        user_id: Number(decoded.sub),
        email: decoded.email,
        account_type: expectedType,
        reset_jti_hash: hash(decoded.jti),
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!challenge) return null;
    const result = { userId: Number(decoded.sub), email: decoded.email };
    await challenge.update({ reset_jti_hash: null }, { transaction });
    return result;
  });
}

function decodeResetToken(resetToken, expectedType) {
  try {
    const decoded = jwt.verify(resetToken, process.env.RESET_TOKEN_SECRET || process.env.JSON_WEB_SECRET, {
      issuer: 'dinewell',
    });
    if (decoded.tokenType !== 'password-reset' || decoded.type !== expectedType) return null;
    return decoded;
  } catch (_) {
    return null;
  }
}

/**
 * Remove OTP for an email
 * @param {string} email - Email address
 */
module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  consumeResetToken,
  decodeResetToken,
};
