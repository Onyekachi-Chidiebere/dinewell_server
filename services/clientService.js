const  User  = require('../models/user');
const bcrypt = require('bcrypt');
const { verifyGoogleToken } = require('../utils/googleAuth');
const { verifyAppleToken } = require('../utils/appleAuth');

// Generate a unique username if the provided one is taken
async function generateUniqueUsername(baseUsername) {
  let username = baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
  let counter = 1;
  let finalUsername = username;
  
  while (true) {
    const existingUser = await User.findOne({ where: { username: finalUsername } });
    if (!existingUser) {
      break;
    }
    finalUsername = `${username}${counter}`;
    counter++;
  }
  
  return finalUsername;
}

// Create a new client account with token verification
async function createClient({ email, username, name, dateOfBirth, gender, provider, idToken, profileImage }) {
  try {
    console.log('create client',{ email, username, name, dateOfBirth, gender, provider, idToken, profileImage })
    let verifiedUserInfo = {};
    let providerId = '';

    // Verify token based on provider
    if (provider === 'google') {
      console.log('got to google client')
      verifiedUserInfo = await verifyGoogleToken(idToken);
      providerId = verifiedUserInfo.googleId;
      
      // Use verified email if different from provided email
      if (verifiedUserInfo.email && verifiedUserInfo.email !== email) {
        email = verifiedUserInfo.email;
      }
      
      // Use Google profile image if available
      if (verifiedUserInfo.picture && !profileImage) {
        profileImage = verifiedUserInfo.picture;
      }
    } else if (provider === 'apple') {
      verifiedUserInfo = await verifyAppleToken(idToken);
      providerId = verifiedUserInfo.appleId;
      
      // Use verified email if different from provided email
      if (verifiedUserInfo.email && verifiedUserInfo.email !== email) {
        email = verifiedUserInfo.email;
      }
    } else {
      console.log('Invalid provider. Only Google and Apple are supported.')
      throw new Error('Invalid provider. Only Google and Apple are supported.');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Generate unique username if needed
    const uniqueUsername = await generateUniqueUsername(username);

    // Create new user
    const user = await User.create({
      email,
      name,
      username: uniqueUsername,
      date_of_birth: dateOfBirth,
      gender,
      provider,
      provider_id: providerId,
      profile_image: profileImage,
      type: 'Customer',
      approval_status: 1, // Auto-approve clients
      date_created: new Date(),
      email_verification_date: new Date(), // Auto-verify for social logins
    });

    return {
      id: user.id,
      email: user.email,
      name:user.name,
      username: user.username,
      dateOfBirth: user.date_of_birth,
      gender: user.gender,
      profileImage: user.profile_image,
      type: user.type,
    };
  } catch (error) {
    console.log({error, message:'failed to create'})
    throw new Error(`Failed to create client: ${error.message}`);
  }
}

// Sign in client with social provider and token verification
async function signInClient({ email, provider, idToken }) {
  try {
    let verifiedUserInfo = {};
    let providerId = '';

    // Verify token based on provider
    if (provider === 'google') {
      verifiedUserInfo = await verifyGoogleToken(idToken);
      providerId = verifiedUserInfo.googleId;
    } else if (provider === 'apple') {
      verifiedUserInfo = await verifyAppleToken(idToken);
      providerId = verifiedUserInfo.appleId;
    } else {
      throw new Error('Invalid provider. Only Google and Apple are supported.');
    }

    // Find user by provider ID and email
    const user = await User.findOne({ 
      where: { 
        email,
        provider,
        provider_id: providerId 
      } 
    });

    if (!user) {
      throw new Error('User not found or invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      dateOfBirth: user.date_of_birth,
      gender: user.gender,
      profileImage: user.profile_image,
      type: user.type,
    };
  } catch (error) {
    throw new Error(`Failed to sign in client: ${error.message}`);
  }
}

// Update client profile
async function updateClientProfile({ userId, username, dateOfBirth, gender, profileImage }) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if username is available (if changed)
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ 
        where: { 
          username,
          id: { [require('sequelize').Op.ne]: userId }
        } 
      });
      
      if (existingUser) {
        throw new Error('Username already taken');
      }
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (dateOfBirth) updateData.date_of_birth = dateOfBirth;
    if (gender) updateData.gender = gender;
    if (profileImage) updateData.profile_image = profileImage;

    await user.update(updateData);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      dateOfBirth: user.date_of_birth,
      gender: user.gender,
      profileImage: user.profile_image,
      type: user.type,
    };
  } catch (error) {
    throw new Error(`Failed to update client profile: ${error.message}`);
  }
}

// Get client profile
async function getClientProfile(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      dateOfBirth: user.date_of_birth,
      gender: user.gender,
      profileImage: user.profile_image,
      type: user.type,
      dateCreated: user.date_created,
    };
  } catch (error) {
    throw new Error(`Failed to get client profile: ${error.message}`);
  }
}

// Check if username is available
async function checkUsernameAvailability(username) {
  try {
    const user = await User.findOne({ where: { username } });
    return { available: !user };
  } catch (error) {
    throw new Error(`Failed to check username availability: ${error.message}`);
  }
}

module.exports = {
  createClient,
  signInClient,
  updateClientProfile,
  getClientProfile,
  checkUsernameAvailability,
  generateUniqueUsername,
};
