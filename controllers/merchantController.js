const merchantService = require('../services/merchantService');
const { generateOTP, storeOTP, verifyOTP, isEmailVerified, removeVerificationToken } = require('../utils/otpService');
const { sendOTPEmail } = require('../utils/emailService');

exports.signupDetails = async (req, res) => {
  try {
    const result = await merchantService.saveDetails(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.signupAddress = async (req, res) => {
  try {
    await merchantService.saveAddress(req.body);
    res.json({ success: true, nextScreen: 'RestaurantPictures' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

function fileFromBase64(part, fallbackName) {
  if (!part?.base64) return null;
  const raw = String(part.base64).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) return null;
  return {
    buffer,
    originalname: part.fileName || fallbackName,
    mimetype: part.type || part.mimeType || 'image/jpeg',
  };
}

exports.signupPictures = async (req, res) => {
  try {
    // Multer puts text fields on req.body; also accept query as fallback
    const merchantId = req.body?.merchantId || req.query?.merchantId;
    console.log('signupPictures body keys:', Object.keys(req.body || {}), {
      merchantId,
      logoCount: req.files?.logo?.length || 0,
      imageCount: req.files?.restaurantImages?.length || 0,
    });
    if (!merchantId) {
      return res.status(400).json({
        error: 'merchantId is required',
        receivedBodyKeys: Object.keys(req.body || {}),
        hasFiles: !!req.files,
      });
    }
    const logo = req.files && req.files.logo ? req.files.logo[0] : null;
    const restaurantImages = req.files && req.files.restaurantImages ? req.files.restaurantImages : [];
    const validLogo = logo && logo.buffer && logo.buffer.length > 0 ? logo : null;
    const validImages = (restaurantImages || []).filter(
      (img) => img && img.buffer && img.buffer.length > 0
    );
    await merchantService.savePictures({
      merchantId,
      logo: validLogo,
      restaurantImages: validImages,
    });
    res.json({ success: true, nextScreen: 'Login' });
  } catch (err) {
    console.error('signupPictures error:', err);
    res.status(400).json({ error: err.message || 'Failed to upload pictures' });
  }
};

/**
 * JSON/base64 upload path — used by React Native Android where multipart FormData
 * often fails with ERR_NETWORK even though JSON login/signup works.
 */
exports.signupPicturesBase64 = async (req, res) => {
  try {
    const started = Date.now();
    const { merchantId, logo, restaurantImages } = req.body || {};
    console.log('[signupPicturesBase64] incoming', {
      merchantId,
      hasLogo: !!logo?.base64,
      imageCount: Array.isArray(restaurantImages) ? restaurantImages.length : 0,
      contentLength: req.headers['content-length'],
    });
    if (!merchantId) {
      return res.status(400).json({ error: 'merchantId is required' });
    }
    const validLogo = fileFromBase64(logo, 'logo.jpg');
    const validImages = (Array.isArray(restaurantImages) ? restaurantImages : [])
      .map((img, idx) => fileFromBase64(img, `image${idx}.jpg`))
      .filter(Boolean);

    if (!validLogo && validImages.length === 0) {
      return res.status(400).json({ error: 'Please include a logo or at least one restaurant picture' });
    }

    await merchantService.savePictures({
      merchantId,
      logo: validLogo,
      restaurantImages: validImages,
    });
    console.log('[signupPicturesBase64] ok', { ms: Date.now() - started });
    res.json({ success: true, nextScreen: 'Login' });
  } catch (err) {
    console.error('signupPicturesBase64 error:', err);
    res.status(400).json({ error: err.message || 'Failed to upload pictures' });
  }
};

exports.completeSignup = async (req, res) => {
  try {
    const { merchantId } = req.body;
    if (!merchantId) {
      return res.status(400).json({ error: 'merchantId is required' });
    }
    const progress = await merchantService.completeSignup({ merchantId });
    res.json({ success: true, ...progress, nextScreen: 'Login' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getSignupProgress = async (req, res) => {
  try {
    const { email, merchantId } = req.query;
    if (!email && !merchantId) {
      return res.status(400).json({ error: 'email or merchantId is required' });
    }
    const progress = await merchantService.getSignupProgress({ email, merchantId });
    if (!progress) {
      return res.json({ found: false });
    }
    res.json({ found: true, ...progress });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.signupCard = (req, res) => {
  try {
    merchantService.saveCard(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const merchant = await merchantService.login(req.body);
    const response = {
      id: merchant.id,
      restaurant_name: merchant.restaurant_name,
      restaurant_logo: merchant.restaurant_logo || null,
      name: merchant.name || null,
      email: merchant.email || null,
      phone: merchant.phone || null,
      date_of_birth: merchant.date_of_birth || null,
      gender: merchant.gender || null,
      profile_image: merchant.profile_image || null,
    };
    res.json(response);
  } catch (err) {
    if (err.code === 'SIGNUP_INCOMPLETE' && err.signupProgress) {
      return res.status(403).json({
        error: err.message,
        code: 'SIGNUP_INCOMPLETE',
        signupProgress: err.signupProgress,
      });
    }
    res.status(400).json({ error: err.message });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const { merchantId } = req.params;
    if (!merchantId) return res.status(400).json({ error: 'merchantId is required' });
    const stats = await merchantService.merchantStatistics(merchantId);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getRestaurants = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await merchantService.getRestaurants(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getRestaurantDetails = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId is required' });
    const result = await merchantService.getRestaurantDetails(restaurantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateMerchantProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, restaurantName, dateOfBirth, gender } = req.body;
    const profileImageFile = req.file; // Multer will attach the file here

    console.log('Update profile request:', {
      userId,
      body: req.body,
      file: profileImageFile ? {
        fieldname: profileImageFile.fieldname,
        originalname: profileImageFile.originalname,
        mimetype: profileImageFile.mimetype,
        size: profileImageFile.size,
        hasBuffer: !!profileImageFile.buffer
      } : 'No file received'
    });

    const merchant = await merchantService.updateMerchantProfile({
      userId,
      name,
      email,
      phone,
      restaurantName,
      dateOfBirth,
      gender,
      profileImageFile
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      merchant
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({ 
      error: err.message 
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: 'Merchant ID is required' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const result = await merchantService.updateMerchantPassword(
      parseInt(merchantId),
      currentPassword,
      newPassword
    );

    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({ 
      error: err.message 
    });
  }
};

exports.sendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if merchant exists with this email
    const merchant = await merchantService.findMerchantByEmail(email);
    if (!merchant) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message: 'If the email exists, an OTP has been sent'
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(email.toLowerCase(), otp);

    // Send OTP via email
    await sendOTPEmail(email, otp);

    res.json({
      success: true,
      message: 'OTP has been sent to your email'
    });
  } catch (err) {
    console.log({ err });
    res.status(500).json({ 
      error: 'Failed to send OTP. Please try again later.'
    });
  }
};

exports.verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Verify OTP
    const isValid = verifyOTP(email.toLowerCase(), otp);

    if (!isValid) {
      return res.status(400).json({ 
        error: 'Invalid or expired OTP. Please request a new one.' 
      });
    }

    // Get merchant info for the reset password screen
    const merchant = await merchantService.findMerchantByEmail(email);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      merchantId: merchant.id,
      email: merchant.email
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({ 
      error: err.message 
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { merchantId, email, newPassword } = req.body;

    if (!merchantId || !email || !newPassword) {
      return res.status(400).json({ error: 'Merchant ID, email, and new password are required' });
    }

    // Verify that email was verified via OTP (within last 15 minutes)
    if (!isEmailVerified(email)) {
      return res.status(400).json({ 
        error: 'OTP verification expired or not verified. Please verify OTP again.' 
      });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Reset password
    const result = await merchantService.resetMerchantPassword(
      parseInt(merchantId),
      newPassword
    );

    // Remove verification token after successful password reset
    removeVerificationToken(email);

    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({ 
      error: err.message 
    });
  }
};
