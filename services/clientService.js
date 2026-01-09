const  User  = require('../models/user');
const bcrypt = require('bcrypt');
const { verifyGoogleToken } = require('../utils/googleAuth');
const { verifyAppleToken } = require('../utils/appleAuth');
const { fn, col, Op } = require('sequelize');
const Points = require('../models/points');
const { getTodayRange } = require('../utils/functions');

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

// Create a new client account with token verification or email/password
async function createClient({ email, username, name, dateOfBirth, gender, provider, idToken, profileImage, password }) {
  try {
    console.log('create client',{ email, username, name, dateOfBirth, gender, provider, idToken, profileImage, hasPassword: !!password })
    let verifiedUserInfo = {};
    let providerId = '';
    let hashedPassword = null;

    // Hash password if provided (for email provider or social providers with password)
    if (password) {
      const saltRounds = 12;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    // Email/password registration
    if (provider === 'email') {
      if (!password) {
        throw new Error('Password is required for email registration');
      }
    } else if (provider === 'google' || provider === 'apple') {
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
      }
    } else {
      console.log('Invalid provider. Only Google, Apple, and email are supported.')
      throw new Error('Invalid provider. Only Google, Apple, and email are supported.');
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
      password: hashedPassword,
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

// Sign in client with social provider and token verification or email/password
async function signInClient({ email, provider, idToken, password }) {
  console.log('sign in client',{ email, provider, idToken, hasPassword: !!password })
  try {
    // Email/password authentication
    if (provider === 'email' && password) {
      const user = await User.findOne({ 
        where: { 
          email,
          // provider: 'email',
          type: 'Customer'
        } 
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (!user.password) {
        throw new Error('Password not set for this account. Please use social login or reset your password.');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        dateOfBirth: user.date_of_birth,
        gender: user.gender,
        profileImage: user.profile_image,
        type: user.type,
      };
    }

    // Social provider authentication (Google/Apple)
    if (!idToken) {
      throw new Error('idToken is required for social provider authentication');
    }

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
      throw new Error('Invalid provider. Only Google, Apple, and email are supported.');
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
      name:user.name,
      username: user.username,
      dateOfBirth: user.date_of_birth,
      gender: user.gender,
      profileImage: user.profile_image,
      type: user.type,
    };
  } catch (error) {
    console.log({error, message:'failed to sign in'})
    throw new Error(`${error.message}`);
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
    console.log({error, message:'failed to update client profile'})
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
    console.log({error, message:'failed to check username availability'})
    throw new Error(`Failed to check username availability: ${error.message}`);
  }
}


async function clientStatistics(clientId) {
  if (!clientId) throw new Error('clientId is required');
  const { start, end } = getTodayRange();

  // Today aggregates
  const [issuedTodayRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: {
      customer_id: clientId,
      type: 'issue',
      status: 'completed',
      date_used: { [Op.between]: [start, end] },
    },
    raw: true,
  });
  const [redeemedTodayRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: {
      customer_id: clientId,
      type: 'redeem',
      status: 'completed',
      date_used: { [Op.between]: [start, end] },
    },
    raw: true,
  });
  const visitsToday = await Points.count({
    where: {
      customer_id: clientId,
      status: 'completed',
      date_used: { [Op.between]: [start, end] },
    },
  });

  // All-time aggregates
  const allTimeVisits = await Points.count({
    where: { customer_id: clientId, status: 'completed' },
  });
  const [issuedAllRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: { customer_id: clientId, type: 'issue', status: 'completed' }, 
    raw: true,
  });
  const [redeemedAllRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: { customer_id: clientId, type: 'redeem', status: 'completed' },
    raw: true,
  });

  // Recent 5 transactions
  const recent = await Points.findAll({
    where: { customer_id: clientId },
    order: [['date_used', 'DESC']],
    limit: 5,
    raw: true,
  });

  const recentWithCustomer = [];
  for (const p of recent) {
    let customerImage = null;
    if (p.customer_id) {
      const customer = await User.findByPk(p.customer_id);
      customerImage = customer ? customer.profile_image || null : null;
    }
    recentWithCustomer.push({
      id: p.id,
      customerImage,
      notes: p.notes || null,
      type: p.type,
      amount: p.total_price,
      points: p.total_points,
      dateUsed: p.date_used,
    });
  }

  return {
    pointsIssuedToday: Number(issuedTodayRow?.sum || 0),
    visitsToday: Number(visitsToday || 0),
    pointsRedeemedToday: Number(redeemedTodayRow?.sum || 0),
    allTimeVisits: Number(allTimeVisits || 0),
    allTimePointsIssued: Number(issuedAllRow?.sum || 0),
    allTimePointsRedeemed: Number(redeemedAllRow?.sum || 0),
    recentTransactions: recentWithCustomer,
    pointsBalance: Number(issuedAllRow?.sum || 0) - Number(redeemedAllRow?.sum || 0),
  };
}
async function getCustomers(page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  
  // Get total customers count
  const totalCustomers = await User.count({
    where: { type: 'Customer' }
  });

  // Get paginated customers with their statistics
  const customers = await User.findAll({
    where: { type: 'Customer' },
    attributes: [
      'id',
      'name',
      'email',
      'phone',
      'date_created'
    ],
    order: [['date_created', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
    raw: true
  });

  // Get statistics for each customer
  const customersWithStats = await Promise.all(
    customers.map(async (customer) => {
      // Get total points earned (issued points)
      const [totalPointsRow] = await Points.findAll({
        attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
        where: {
          customer_id: customer.id,
          type: 'issue',
          status: 'completed'
        },
        raw: true
      });

      // Get total restaurants visited (unique restaurant count)
      const uniqueRestaurants = await Points.findAll({
        attributes: [[fn('COUNT', fn('DISTINCT', col('restaurant_id'))), 'count']],
        where: {
          customer_id: customer.id,
          status: 'completed'
        },
        raw: true
      });

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || 'Not provided',
        total_points_earned: Number(totalPointsRow?.sum || 0),
        total_restaurants_visited: Number(uniqueRestaurants[0]?.count || 0),
        date_created: customer.date_created
      };
    })
  );

  return {
    statistics: {
      total_customers: totalCustomers
    },
    customers: customersWithStats,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCustomers / limit),
      totalItems: totalCustomers,
      itemsPerPage: parseInt(limit)
    }
  };
}

async function getCustomerDetails(customerId, page = 1, limit = 10) {
  if (!customerId) throw new Error('customerId is required');

  const offset = (page - 1) * limit;

  // Get customer info
  const customer = await User.findByPk(customerId, {
    where: { type: 'Customer' },
    attributes: [
      'id',
      'name',
      'email',
      'phone',
      'profile_image'
    ],
    raw: true
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Get total restaurant visits (count of all completed transactions)
  const totalRestaurantVisits = await Points.count({
    where: {
      customer_id: customerId,
      status: 'completed'
    }
  });

  // Get total points earned (sum of all issued points)
  const [pointsEarnedRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: {
      customer_id: customerId,
      type: 'issue',
      status: 'completed'
    },
    raw: true
  });

  // Get total points redeemed (sum of all redeemed points)
  const [pointsRedeemedRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: {
      customer_id: customerId,
      type: 'redeem',
      status: 'completed'
    },
    raw: true
  });

  // Get paginated point transactions with restaurant names
  const pointTransactions = await Points.findAll({
    where: {
      customer_id: customerId,
      status: 'completed'
    },
    attributes: [
      'id',
      'restaurant_id',
      'total_points',
      'type',
      'date_used',
      'date_created'
    ],
    order: [['date_used', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
    raw: true
  });

  // Get unique restaurant IDs from transactions
  const restaurantIds = [...new Set(pointTransactions.map(t => t.restaurant_id))];

  // Get restaurant names
  const restaurants = await User.findAll({
    where: {
      id: { [Op.in]: restaurantIds },
      type: 'Merchant'
    },
    attributes: [
      'id',
      'restaurant_name'
    ],
    raw: true
  });

  // Create a map of restaurant IDs to names
  const restaurantMap = {};
  restaurants.forEach(r => {
    restaurantMap[r.id] = r.restaurant_name;
  });

  // Format point transactions with restaurant names
  const formattedTransactions = pointTransactions.map(transaction => ({
    id: transaction.id,
    restaurant_name: restaurantMap[transaction.restaurant_id] || 'Unknown Restaurant',
    points: transaction.total_points,
    point_type: transaction.type === 'issue' ? 'Earned' : 'Redeemed',
    date_used: transaction.date_used 
  }));

  // Get total count for pagination
  const totalTransactions = await Points.count({
    where: {
      customer_id: customerId,
      status: 'completed'
    }
  });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone || 'Not provided',
      profile_image: customer.profile_image
    },
    statistics: {
      total_restaurant_visits: totalRestaurantVisits,
      points_earned: Number(pointsEarnedRow?.sum || 0),
      points_redeemed: Number(pointsRedeemedRow?.sum || 0)
    },
    point_transactions: formattedTransactions,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalTransactions / limit),
      totalItems: totalTransactions,
      itemsPerPage: parseInt(limit)
    }
  };
}

module.exports = {
  createClient,
  signInClient,
  updateClientProfile,
  getClientProfile,
  checkUsernameAvailability,
  generateUniqueUsername,
  clientStatistics,
  getCustomers,
  getCustomerDetails
};
