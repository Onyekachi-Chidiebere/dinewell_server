const  User  = require('../models/user');
const bcrypt = require('bcrypt');
const { verifyGoogleToken } = require('../utils/googleAuth');
const { verifyAppleToken } = require('../utils/appleAuth');
const { fn, col, Op } = require('sequelize');
const Points = require('../models/points');
const { getTodayRange, getCurrentWeekRange } = require('../utils/functions');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');

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
async function updateClientProfile({ userId, username, dateOfBirth, gender, name, profileImageFile }) {
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
    if (name) updateData.name = name;

    // Handle profile image upload to Cloudinary
    if (profileImageFile) {
      try {
        const imageUrl = await uploadBufferToCloudinary(
          profileImageFile.buffer,
          'client-profiles',
          `profile-${userId}-${Date.now()}`,
          profileImageFile.mimetype
        );
        updateData.profile_image = imageUrl;
      } catch (uploadError) {
        console.error('Error uploading profile image to Cloudinary:', uploadError);
        throw new Error('Failed to upload profile image');
      }
    }

    await user.update(updateData);

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

// Share points between clients
async function sharePoints({ senderId, recipientUsername, points }) {
  try {
    if (!senderId || !recipientUsername || !points) {
      throw new Error('Sender ID, recipient username, and points are required');
    }

    if (points <= 0) {
      throw new Error('Points must be greater than 0');
    }

    // Find recipient by username
    const recipient = await User.findOne({
      where: {
        username: recipientUsername,
        type: 'Customer'
      }
    });

    if (!recipient) {
      throw new Error('Recipient not found');
    }

    if (recipient.id === senderId) {
      throw new Error('Cannot share points with yourself');
    }

    // Calculate sender's current points balance
    const [senderIssuedRow] = await Points.findAll({
      attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
      where: {
        customer_id: senderId,
        type: 'issue',
        status: 'completed'
      },
      raw: true,
    });

    const [senderRedeemedRow] = await Points.findAll({
      attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
      where: {
        customer_id: senderId,
        type: 'redeem',
        status: 'completed'
      },
      raw: true,
    });

    const senderBalance = Number(senderIssuedRow?.sum || 0) - Number(senderRedeemedRow?.sum || 0);

    // Validate sender has enough points
    if (senderBalance < points) {
      throw new Error(`Insufficient points. Available: ${senderBalance}, Requested: ${points}`);
    }

    // Get sender info for notes
    const sender = await User.findByPk(senderId);
    if (!sender) {
      throw new Error('Sender not found');
    }

    const shareReference = `SHARE_${Date.now()}_${senderId}_${recipient.id}`;
    const now = new Date();

    // Create redeem transaction for sender (deduct points)
    const senderTransaction = await Points.create({
      status: 'completed',
      type: 'redeem',
      restaurant_id: null, // No restaurant for shared points
      customer_id: senderId,
      dishes: [],
      total_price: 0,
      total_points: points,
      points_per_dollar: 0,
      qr_code: null,
      date_used: now,
      notes: `Shared ${points} points with ${recipient.username} (${shareReference})`
    });

    // Create issue transaction for recipient (add points)
    const recipientTransaction = await Points.create({
      status: 'completed',
      type: 'issue',
      restaurant_id: null, // No restaurant for shared points
      customer_id: recipient.id,
      dishes: [],
      total_price: 0,
      total_points: points,
      points_per_dollar: 0,
      qr_code: null,
      date_used: now,
      notes: `Received ${points} points from ${sender.username} (${shareReference})`
    });

    return {
      success: true,
      message: `Successfully shared ${points} points with ${recipient.username}`,
      senderBalance: senderBalance - points,
      recipientBalance: points, // This is just the amount received, not total balance
      shareReference
    };
  } catch (error) {
    console.log({ error, message: 'failed to share points' });
    throw new Error(`Failed to share points: ${error.message}`);
  }
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

// Get restaurants visited data grouped by week
async function getRestaurantsVisitedData(clientId) {
  try {
    if (!clientId) throw new Error('clientId is required');

    // Get all-time visits count (all completed transactions)
    const totalVisits = await Points.count({
      where: {
        customer_id: clientId,
        status: 'completed'
      }
    });

    // Get current week range (Monday to Sunday)
    const { start: weekStart, end: weekEnd } = getCurrentWeekRange();

    // Get this week's visits count
    const thisWeek = await Points.count({
      where: {
        customer_id: clientId,
        status: 'completed',
        date_used: { [Op.between]: [weekStart, weekEnd] }
      }
    });

    // Get all transactions for this week (both issue and redeem count as visits)
    const weekTransactions = await Points.findAll({
      where: {
        customer_id: clientId,
        status: 'completed',
        date_used: { [Op.between]: [weekStart, weekEnd] }
      },
      order: [['date_used', 'DESC']],
      raw: true,
    });

    // Get restaurant IDs
    const restaurantIds = [...new Set(weekTransactions.map(t => t.restaurant_id).filter(Boolean))];
    
    // Get restaurant names and logos
    const restaurants = await User.findAll({
      where: {
        id: { [Op.in]: restaurantIds },
        type: 'Merchant'
      },
      attributes: ['id', 'restaurant_name', 'profile_image', 'restaurant_logo'],
      raw: true
    });

    const restaurantMap = {};
    restaurants.forEach(r => {
      restaurantMap[r.id] = {
        name: r.restaurant_name,
        logo: r.restaurant_logo || r.profile_image || null
      };
    });

    // Group transactions by day
    const dayMap = new Map();
    
    weekTransactions.forEach((transaction) => {
      const dateUsed = new Date(transaction.date_used);
      const dateKey = dateUsed.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!dayMap.has(dateKey)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dateUsed.getDay()];
        const formattedDate = `${String(dateUsed.getDate()).padStart(2, '0')}/${String(dateUsed.getMonth() + 1).padStart(2, '0')}/${dateUsed.getFullYear()}`;
        
        dayMap.set(dateKey, {
          date: formattedDate,
          dayName: dayName,
          transactions: []
        });
      }
      
      const dayData = dayMap.get(dateKey);
      const restaurant = restaurantMap[transaction.restaurant_id] || { name: 'Unknown Restaurant', logo: null };
      
      dayData.transactions.push({
        id: transaction.id.toString(),
        logo: restaurant.logo,
        restaurant: restaurant.name,
        order: dayData.transactions.length + 1
      });
    });

    // Convert map to array and sort by date (newest first)
    const weekData = Array.from(dayMap.values()).sort((a, b) => {
      // Parse dates for comparison
      const dateA = a.date.split('/').reverse().join('-');
      const dateB = b.date.split('/').reverse().join('-');
      return new Date(dateB) - new Date(dateA);
    });

    return {
      totalVisits,
      thisWeek,
      weekData
    };
  } catch (error) {
    console.log({ error, message: 'failed to get restaurants visited data' });
    throw new Error(`Failed to get restaurants visited data: ${error.message}`);
  }
}

// Get points earned data grouped by week
async function getPointsEarnedData(clientId) {
  try {
    if (!clientId) throw new Error('clientId is required');

    // Get all-time points earned
    const [allTimeRow] = await Points.findAll({
      attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
      where: {
        customer_id: clientId,
        type: 'issue',
        status: 'completed'
      },
      raw: true,
    });

    const totalPoints = Number(allTimeRow?.sum || 0);

    // Get current week range (Monday to Sunday)
    const { start: weekStart, end: weekEnd } = getCurrentWeekRange();

    // Get this week's points earned
    const [thisWeekRow] = await Points.findAll({
      attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
      where: {
        customer_id: clientId,
        type: 'issue',
        status: 'completed',
        date_used: { [Op.between]: [weekStart, weekEnd] }
      },
      raw: true,
    });

    const thisWeek = Number(thisWeekRow?.sum || 0);

    // Get all transactions for this week
    const weekTransactions = await Points.findAll({
      where: {
        customer_id: clientId,
        type: 'issue',
        status: 'completed',
        date_used: { [Op.between]: [weekStart, weekEnd] }
      },
      order: [['date_used', 'DESC']],
      raw: true,
    });

    // Get restaurant IDs
    const restaurantIds = [...new Set(weekTransactions.map(t => t.restaurant_id).filter(Boolean))];
    
    // Get restaurant names
    const restaurants = await User.findAll({
      where: {
        id: { [Op.in]: restaurantIds },
        type: 'Merchant'
      },
      attributes: ['id', 'restaurant_name'],
      raw: true
    });

    const restaurantMap = {};
    restaurants.forEach(r => {
      restaurantMap[r.id] = r.restaurant_name;
    });

    // Group transactions by day
    const dayMap = new Map();
    
    weekTransactions.forEach((transaction, index) => {
      const dateUsed = new Date(transaction.date_used);
      const dateKey = dateUsed.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!dayMap.has(dateKey)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dateUsed.getDay()];
        const formattedDate = `${String(dateUsed.getDate()).padStart(2, '0')}/${String(dateUsed.getMonth() + 1).padStart(2, '0')}/${dateUsed.getFullYear()}`;
        
        dayMap.set(dateKey, {
          date: formattedDate,
          dayName: dayName,
          transactions: []
        });
      }
      
      const dayData = dayMap.get(dateKey);
      dayData.transactions.push({
        id: transaction.id.toString(),
        points: transaction.total_points,
        restaurant: restaurantMap[transaction.restaurant_id] || 'Unknown Restaurant',
        order: dayData.transactions.length + 1
      });
    });

    // Convert map to array and sort by date (newest first)
    const weekData = Array.from(dayMap.values()).sort((a, b) => {
      // Parse dates for comparison
      const dateA = a.date.split('/').reverse().join('-');
      const dateB = b.date.split('/').reverse().join('-');
      return new Date(dateB) - new Date(dateA);
    });

    return {
      totalPoints,
      thisWeek,
      weekData
    };
  } catch (error) {
    console.log({ error, message: 'failed to get points earned data' });
    throw new Error(`Failed to get points earned data: ${error.message}`);
  }
}

// Get restaurants visited by client with total points earned at each
async function getVisitedRestaurants(clientId) {
  try {
    if (!clientId) throw new Error('clientId is required');

    // Get all completed transactions for this client
    const allTransactions = await Points.findAll({
      where: {
        customer_id: clientId,
        status: 'completed',
        type: 'issue' // Only count points earned (issued), not redeemed
      },
      attributes: ['restaurant_id', 'total_points'],
      raw: true,
    });

    if (allTransactions.length === 0) {
      return {
        restaurants: []
      };
    }

    // Group by restaurant and sum points
    const restaurantPointsMap = {};
    const restaurantIds = new Set();
    
    allTransactions.forEach(transaction => {
      if (transaction.restaurant_id) {
        restaurantIds.add(transaction.restaurant_id);
        if (!restaurantPointsMap[transaction.restaurant_id]) {
          restaurantPointsMap[transaction.restaurant_id] = 0;
        }
        restaurantPointsMap[transaction.restaurant_id] += transaction.total_points;
      }
    });

    // Get restaurant details
    const restaurants = await User.findAll({
      where: {
        id: { [Op.in]: Array.from(restaurantIds) },
        type: 'Merchant'
      },
      attributes: [
        'id',
        'restaurant_name',
        'restaurant_logo',
        'profile_image',
        'restaurant_images'
      ],
      raw: true
    });

    // Format restaurants with total points
    const formattedRestaurants = restaurants.map(restaurant => {
      const totalPoints = restaurantPointsMap[restaurant.id] || 0;
      const restaurantImage = restaurant.restaurant_images && restaurant.restaurant_images.length > 0 
        ? restaurant.restaurant_images[0] 
        : restaurant.profile_image || null;
      const restaurantLogo = restaurant.restaurant_logo || restaurant.profile_image || null;

      return {
        id: restaurant.id.toString(),
        name: restaurant.restaurant_name || 'Unknown Restaurant',
        location: 'Montreal, Canada', // Default location, can be updated if location field exists
        image: restaurantImage,
        logo: restaurantLogo,
        rating: 4.5, // Default rating, can be updated if rating field exists
        points: totalPoints,
        category: 'Fine Dining' // Default category, can be updated if category field exists
      };
    });

    // Sort by points earned (descending)
    formattedRestaurants.sort((a, b) => b.points - a.points);

    return {
      restaurants: formattedRestaurants
    };
  } catch (error) {
    console.log({ error, message: 'failed to get visited restaurants' });
    throw new Error(`Failed to get visited restaurants: ${error.message}`);
  }
}

// Get transaction history grouped by day (all transactions, not just this week)
async function getTransactionHistory(clientId) {
  try {
    if (!clientId) throw new Error('clientId is required');

    // Get all completed transactions (both issue and redeem)
    const allTransactions = await Points.findAll({
      where: {
        customer_id: clientId,
        status: 'completed'
      },
      order: [['date_used', 'DESC']],
      raw: true,
    });

    if (allTransactions.length === 0) {
      return {
        weekData: []
      };
    }

    // Get restaurant IDs
    const restaurantIds = [...new Set(allTransactions.map(t => t.restaurant_id).filter(Boolean))];
    
    // Get restaurant names
    const restaurants = await User.findAll({
      where: {
        id: { [Op.in]: restaurantIds },
        type: 'Merchant'
      },
      attributes: ['id', 'restaurant_name'],
      raw: true
    });

    const restaurantMap = {};
    restaurants.forEach(r => {
      restaurantMap[r.id] = r.restaurant_name;
    });

    // Group transactions by day
    const dayMap = new Map();
    
    allTransactions.forEach((transaction) => {
      const dateUsed = new Date(transaction.date_used);
      const dateKey = dateUsed.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!dayMap.has(dateKey)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dateUsed.getDay()];
        const formattedDate = `${String(dateUsed.getDate()).padStart(2, '0')}/${String(dateUsed.getMonth() + 1).padStart(2, '0')}/${dateUsed.getFullYear()}`;
        
        dayMap.set(dateKey, {
          date: formattedDate,
          dayName: dayName,
          transactions: []
        });
      }
      
      const dayData = dayMap.get(dateKey);
      dayData.transactions.push({
        id: transaction.id.toString(),
        points: transaction.total_points,
        restaurant: restaurantMap[transaction.restaurant_id] || 'Unknown Restaurant',
        order: dayData.transactions.length + 1
      });
    });

    // Convert map to array and sort by date (newest first)
    const weekData = Array.from(dayMap.values()).sort((a, b) => {
      // Parse dates for comparison
      const dateA = a.date.split('/').reverse().join('-');
      const dateB = b.date.split('/').reverse().join('-');
      return new Date(dateB) - new Date(dateA);
    });

    return {
      weekData
    };
  } catch (error) {
    console.log({ error, message: 'failed to get transaction history' });
    throw new Error(`Failed to get transaction history: ${error.message}`);
  }
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
  getCustomerDetails,
  sharePoints,
  getPointsEarnedData,
  getRestaurantsVisitedData,
  getTransactionHistory,
  getVisitedRestaurants
};
