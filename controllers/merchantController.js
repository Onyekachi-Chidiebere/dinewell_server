const merchantService = require('../services/merchantService');
const { generateOTP, storeOTP, verifyOTP, isEmailVerified, removeVerificationToken } = require('../utils/otpService');
const { sendOTPEmail } = require('../utils/emailService');

exports.signupDetails = async (req, res) => {
  try {
    const merchantId = await merchantService.saveDetails(req.body);
    res.json({ merchantId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.signupAddress = (req, res) => {
  try {
    merchantService.saveAddress(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.signupPictures = async (req, res) => {
  try {
    // logo: req.files.logo (single), restaurantImages: req.files.restaurantImages (array)
    const { merchantId } = req.body;
    const logo = req.files && req.files.logo ? req.files.logo[0] : null;
    const restaurantImages = req.files && req.files.restaurantImages ? req.files.restaurantImages : [];
    await merchantService.savePictures({ merchantId, logo, restaurantImages });
    res.json({ success: true });
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
