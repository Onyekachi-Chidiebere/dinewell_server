const bcrypt = require('bcrypt');
const User = require('../models/user');
const { rotateRefreshToken, revokeRefreshToken, revokeAllForUser } = require('../services/authService');
const { generateOTP, storeOTP, verifyOTP, consumeResetToken } = require('../utils/otpService');
const { sendOTPEmail } = require('../utils/emailService');
const { sequelize } = require('../utils/db-connection');
const DeviceToken = require('../models/deviceToken');
const Socket = require('../models/socket');
const Notification = require('../models/notification');
const Points = require('../models/points');
const { verifyGoogleToken } = require('../utils/googleAuth');
const { verifyAppleToken } = require('../utils/appleAuth');

exports.refresh = async (req, res) => {
  try {
    const tokens = await rotateRefreshToken(req.body?.refreshToken);
    res.json(tokens);
  } catch (error) {
    res.status(error.status || 401).json({ error: error.message });
  }
};

exports.logout = async (req, res) => {
  await revokeRefreshToken(req.body?.refreshToken);
  res.status(204).end();
};

function accountTypeFor(routeType) {
  return routeType === 'Merchant' ? 'Merchant' : 'Customer';
}

exports.sendResetOtp = (routeType) => async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const type = accountTypeFor(routeType);
  const user = await User.findOne({ where: { email, type } });
  if (user) {
    const otp = generateOTP();
    await storeOTP(email, otp, { userId: user.id, accountType: type });
    await sendOTPEmail(email, otp);
  }
  return res.json({ success: true, message: 'If the email exists, an OTP has been sent' });
};

exports.verifyResetOtp = (routeType) => async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const result = await verifyOTP(email, String(req.body?.otp || ''), accountTypeFor(routeType));
  if (!result) return res.status(400).json({ error: 'Invalid or expired OTP' });
  return res.json({
    success: true,
    message: 'OTP verified successfully',
    resetToken: result.resetToken,
    email: result.email,
  });
};

exports.resetPassword = (routeType) => async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'resetToken and a password of at least 8 characters are required' });
  }
  const type = accountTypeFor(routeType);
  const binding = await consumeResetToken(resetToken, type);
  if (!binding) return res.status(400).json({ error: 'Invalid, expired, or already used resetToken' });
  const user = await User.findOne({ where: { id: binding.userId, email: binding.email, type } });
  if (!user) return res.status(400).json({ error: 'Reset token account mismatch' });
  await user.update({ password: await bcrypt.hash(newPassword, 12) });
  await revokeAllForUser(user.id);
  return res.json({ success: true, message: 'Password reset successfully' });
};

exports.deleteMe = async (req, res) => {
  const user = req.auth.user;
  if (user.provider === 'email' || !user.provider) {
    const valid = req.body?.password && user.password && await bcrypt.compare(req.body.password, user.password);
    if (!valid) return res.status(403).json({ error: 'Current password is required' });
  } else {
    if (!req.body?.providerToken) {
      return res.status(403).json({ error: 'A fresh providerToken is required' });
    }
    try {
      const identity = user.provider === 'google'
        ? await verifyGoogleToken(req.body.providerToken)
        : await verifyAppleToken(req.body.providerToken);
      const providerId = identity.googleId || identity.appleId;
      if (String(providerId) !== String(user.provider_id)) {
        return res.status(403).json({ error: 'Provider reauthentication does not match this account' });
      }
    } catch (_) {
      return res.status(403).json({ error: 'Provider reauthentication failed' });
    }
  }

  await sequelize.transaction(async (transaction) => {
    await revokeAllForUser(user.id, transaction);
    await DeviceToken.destroy({ where: { user_id: user.id }, transaction });
    await Socket.destroy({ where: { user_id: user.id }, transaction });
    await Notification.destroy({ where: { user_id: user.id }, transaction });
    if (String(user.type).toLowerCase() === 'customer') {
      await Points.update({ customer_id: null }, { where: { customer_id: user.id }, transaction });
    }
    await user.update({
      email: `deleted+${user.id}@invalid.local`,
      name: 'Deleted user',
      username: null,
      phone: null,
      password: null,
      provider_id: null,
      profile_image: null,
      stripe_id: null,
      payment_cards: [],
      default_payment_card_id: null,
      approval_status: -1,
    }, { transaction });
  });
  const io = req.app.get('io');
  io?.in(`user:${user.id}`).disconnectSockets(true);
  return res.json({ success: true, result: 'account_anonymized' });
};
