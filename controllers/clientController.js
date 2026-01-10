const clientService = require('../services/clientService');

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