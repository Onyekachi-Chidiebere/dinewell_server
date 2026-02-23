const clientService = require('../services/clientService');
const { sendOTPEmail } = require('../utils/emailService');
const { generateOTP, storeOTP, verifyOTP, isEmailVerified, removeVerificationToken } = require('../utils/otpService');

// Create new client account
exports.createClient = async (req, res) => {
  try {
    const {
      name,
      email,
      username,
      dateOfBirth,
      gender,
      provider,
      idToken,
      profileImage,
      password
    } = req.body;

    // Validate required fields based on provider
    if (provider === 'email') {
      if (!email || !username || !name || !password) {
        return res.status(400).json({ 
          error: 'Email, username, name, and password are required' 
        });
      }
    } else {
      if (!email || !username || !name || !provider || !idToken) {
      return res.status(400).json({ 
          error: 'Email, username, name, provider, and idToken are required' 
      });
      }
    }

    const client = await clientService.createClient({
      name,
      email,
      username,
      dateOfBirth,
      gender,
      provider,
      idToken,
      profileImage,
      password
    });

    res.status(201).json({
      success: true,
      message: 'Client account created successfully',
      client
    });
  } catch (err) {
    console.log({err})
    res.status(400).json({ 
      error: err.message 
    });
  }
};

// Sign in client
exports.signInClient = async (req, res) => {
  try {
    const { email, provider, idToken, password } = req.body;
    // For email/password authentication
    if (provider === 'email') {
      if (!email || !password) {
        return res.status(400).json({ 
          error: 'Email and password are required' 
        });
      }
    } else {
      // For social provider authentication
    if (!email || !provider || !idToken) {
      return res.status(400).json({ 
        error: 'Email, provider, and idToken are required' 
      });
      }
    }

    const client = await clientService.signInClient({
      email,
      provider,
      idToken,
      password
    });

    res.json({
      success: true,
      message: 'Client signed in successfully',
      client
    });
  } catch (err) {
    res.status(401).json({ 
      error: err.message 
    });
  }
};

// Update client profile
exports.updateClientProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, dateOfBirth, gender, name } = req.body;
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

    const client = await clientService.updateClientProfile({
      userId,
      username,
      dateOfBirth,
      gender,
      name,
      profileImageFile
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      client
    });
  } catch (err) {
    console.log({err})
    res.status(400).json({ 
      error: err.message 
    });
  }
};

// Get client profile
exports.getClientProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const client = await clientService.getClientProfile(userId);

    res.json({
      success: true,
      client
    });
  } catch (err) {
    res.status(404).json({ 
      error: err.message 
    });
  }
};

// Check username availability
exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ 
        error: 'Username is required' 
      });
    }

    const result = await clientService.checkUsernameAvailability(username);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(400).json({ 
      error: err.message 
    });
  }
};

// Generate unique username suggestion
exports.generateUsernameSuggestion = async (req, res) => {
  try {
    const { baseUsername } = req.body;

    if (!baseUsername) {
      return res.status(400).json({ 
        error: 'Base username is required' 
      });
    }

    const uniqueUsername = await clientService.generateUniqueUsername(baseUsername);

    res.json({
      success: true,
      suggestedUsername: uniqueUsername
    });
  } catch (err) {
    res.status(400).json({ 
      error: err.message 
    });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });
    const stats = await clientService.clientStatistics(clientId);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const result = await clientService.updateCustomerPassword(
      parseInt(customerId),
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

    // Check if client exists with this email
    const customer = await clientService.findCustomerByEmail(email);
    if (!customer) {
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

    // Get Cusromer info for the reset password screen
    const customer = await clientService.findCustomerByEmail(email);
    if (!customer) {
      return res.status(404).json({ error: 'Cutomer not found' });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      customerId: customer.id,
      email: customer.email
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
    const { customerId, email, newPassword } = req.body;

    if (!customerId || !email || !newPassword) {
      return res.status(400).json({ error: 'Customer ID, email, and new password are required' });
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
    const result = await clientService.resetCustomerPassword(
      parseInt(customerId),
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
exports.getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await clientService.getCustomers(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getCustomerDetails = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    if (!customerId) return res.status(400).json({ error: 'customerId is required' });
    const result = await clientService.getCustomerDetails(customerId, parseInt(page), parseInt(limit));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Share points between clients
exports.sharePoints = async (req, res) => {
  try {
    const { senderId } = req.params;
    const { recipientUsername, points } = req.body;

    if (!senderId || !recipientUsername || !points) {
      return res.status(400).json({
        error: 'Sender ID, recipient username, and points are required'
      });
    }

    const result = await clientService.sharePoints({
      senderId: parseInt(senderId),
      recipientUsername,
      points: parseInt(points)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({
      error: err.message
    });
  }
};

// Get points earned data for client
exports.getPointsEarnedData = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({
        error: 'Client ID is required'
      });
    }

    const result = await clientService.getPointsEarnedData(parseInt(clientId));

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({
      error: err.message
    });
  }
};

// Get restaurants visited data for client
exports.getRestaurantsVisitedData = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({
        error: 'Client ID is required'
      });
    }

    const result = await clientService.getRestaurantsVisitedData(parseInt(clientId));

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({
      error: err.message
    });
  }
};

// Get transaction history for client
exports.getTransactionHistory = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({
        error: 'Client ID is required'
      });
    }

    const result = await clientService.getTransactionHistory(parseInt(clientId));

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({
      error: err.message
    });
  }
};

// Get visited restaurants for client
exports.getVisitedRestaurants = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { search } = req.query;
    
    if (!clientId) {
      return res.status(400).json({
        error: 'Client ID is required'
      });
    }

    const result = await clientService.getVisitedRestaurants(parseInt(clientId), search || '');

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({
      error: err.message
    });
  }
};

// Get all restaurants with total points issued
exports.getAllRestaurants = async (req, res) => {
  try {
    const { search } = req.query;
    const result = await clientService.getAllRestaurants(search || '');

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.log({ err });
    res.status(400).json({
      error: err.message
    });
  }
};