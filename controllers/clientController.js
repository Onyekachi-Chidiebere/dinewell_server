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
      profileImage
    } = req.body;

    // Validate required fields
    if (!email || !username ||  !name ||!provider || !idToken) {
      return res.status(400).json({ 
        error: 'Email, username, provider, and idToken are required' 
      });
    }

    const client = await clientService.createClient({
      name,
      email,
      username,
      dateOfBirth,
      gender,
      provider,
      idToken,
      profileImage
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
    const { email, provider, idToken } = req.body;

    if (!email || !provider || !idToken) {
      return res.status(400).json({ 
        error: 'Email, provider, and idToken are required' 
      });
    }

    const client = await clientService.signInClient({
      email,
      provider,
      idToken
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
    const { username, dateOfBirth, gender, profileImage } = req.body;

    const client = await clientService.updateClientProfile({
      userId,
      username,
      dateOfBirth,
      gender,
      profileImage
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      client
    });
  } catch (err) {
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
