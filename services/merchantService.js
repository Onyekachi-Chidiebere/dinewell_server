const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op, fn, col, literal } = require('sequelize');
const User = require('../models/user');
const Points = require('../models/points');
const { getTodayRange } = require('../utils/functions');

function normalizeUserResponse(userInstance) {
  const user = userInstance.get({ plain: true });
  delete user.password;
  return user;
}

const APPROVAL = {
  PENDING: 0,
  APPROVED: 1,
  DISABLED: -1,
};

function mapApprovalStatus(approvalStatus) {
  if (approvalStatus === APPROVAL.APPROVED) return 'active';
  if (approvalStatus === APPROVAL.DISABLED) return 'disabled';
  return 'pending';
}

function pendingApprovalWhere() {
  return {
    [Op.or]: [{ approval_status: APPROVAL.PENDING }, { approval_status: null }],
  };
}

function merchantStatusWhere(statusFilter) {
  if (!statusFilter || statusFilter === 'all') return {};
  if (statusFilter === 'active') return { approval_status: APPROVAL.APPROVED };
  if (statusFilter === 'pending') return pendingApprovalWhere();
  if (statusFilter === 'disabled') return { approval_status: APPROVAL.DISABLED };
  if (statusFilter === 'over_limit') return { points_blocked: true };
  if (statusFilter === 'payment_failed') return { payment_failed: true };
  if (statusFilter === 'no_card') {
    return {
      [Op.or]: [
        { default_payment_card_id: null },
        { default_payment_card_id: '' },
      ],
    };
  }
  return {};
}

const SIGNUP_STEPS = {
  DETAILS: 'details',
  ADDRESS: 'address',
  PICTURES: 'pictures',
  COMPLETE: 'complete',
};

function getRegionsObject(user) {
  if (!user?.regions) return {};
  if (typeof user.regions === 'object' && !Array.isArray(user.regions)) {
    return { ...user.regions };
  }
  return {};
}

function getSignupStep(user) {
  const regions = getRegionsObject(user);
  if (regions.signup_step) return regions.signup_step;
  // Derive from data for older rows
  const address = regions.address || {};
  const hasAddress = !!(address.streetNumber && address.streetName && address.area);
  const hasPictures =
    !!user.restaurant_logo ||
    (Array.isArray(user.restaurant_images) && user.restaurant_images.length > 0);
  if (hasPictures) return SIGNUP_STEPS.COMPLETE;
  if (hasAddress) return SIGNUP_STEPS.PICTURES;
  return SIGNUP_STEPS.ADDRESS;
}

function nextScreenForStep(step) {
  switch (step) {
    case SIGNUP_STEPS.DETAILS:
      return 'RestaurantDetails';
    case SIGNUP_STEPS.ADDRESS:
      return 'RestaurantAddress';
    case SIGNUP_STEPS.PICTURES:
      return 'RestaurantPictures';
    case SIGNUP_STEPS.COMPLETE:
      return 'Login';
    default:
      return 'RestaurantDetails';
  }
}

function buildSignupProgress(user) {
  const regions = getRegionsObject(user);
  const address = regions.address || {};
  const step = getSignupStep(user);
  return {
    merchantId: user.id,
    email: user.email,
    signupStep: step,
    nextScreen: nextScreenForStep(step),
    completed: step === SIGNUP_STEPS.COMPLETE,
    restaurantDetails: {
      name: user.restaurant_name || '',
      phone: user.phone || '',
      email: user.email || '',
      location: address.location || '',
      streetNumber: address.streetNumber || '',
      streetName: address.streetName || '',
      area: address.area || '',
      restaurantLogo: user.restaurant_logo || null,
      restaurantImages: Array.isArray(user.restaurant_images) ? user.restaurant_images : [],
    },
  };
}

async function saveDetails({ name, phone, email, location, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');

  const existing = await User.findOne({
    where: { email: normalizedEmail, type: 'Merchant' },
  });

  const hashedPassword = await bcrypt.hash(password, 10);

  if (existing) {
    const step = getSignupStep(existing);
    if (step === SIGNUP_STEPS.COMPLETE) {
      throw new Error('An account with this email already exists. Please log in.');
    }
    // Resume: update details for incomplete signup without rolling progress backward
    const regions = getRegionsObject(existing);
    const address = { ...(regions.address || {}), location };
    const nextStep =
      step === SIGNUP_STEPS.PICTURES ? SIGNUP_STEPS.PICTURES : SIGNUP_STEPS.ADDRESS;
    await existing.update({
      restaurant_name: name,
      phone,
      email: normalizedEmail,
      password: hashedPassword,
      regions: {
        ...regions,
        address,
        signup_step: nextStep,
      },
    });
    return {
      merchantId: existing.id,
      signupStep: nextStep,
      nextScreen: nextScreenForStep(nextStep),
    };
  }

  const user = await User.create({
    restaurant_name: name,
    phone,
    email: normalizedEmail,
    password: hashedPassword,
    type: 'Merchant',
    approval_status: APPROVAL.PENDING,
    date_created: new Date(),
    regions: {
      address: { location },
      signup_step: SIGNUP_STEPS.ADDRESS,
    },
  });
  return {
    merchantId: user.id,
    signupStep: SIGNUP_STEPS.ADDRESS,
    nextScreen: nextScreenForStep(SIGNUP_STEPS.ADDRESS),
  };
}

async function saveAddress({ merchantId, streetNumber, streetName, area }) {
  const user = await User.findByPk(merchantId);
  if (!user) throw new Error('Merchant not found');
  const regions = getRegionsObject(user);
  const address = {
    ...(regions.address || {}),
    streetNumber,
    streetName,
    area,
  };
  await user.update({
    regions: {
      ...regions,
      address,
      signup_step: SIGNUP_STEPS.PICTURES,
    },
  });
}

async function savePictures({ merchantId, logo, restaurantImages }) {
  const user = await User.findByPk(merchantId);
  if (!user) throw new Error('Merchant not found');

  let restaurantLogo = user.restaurant_logo || null;
  let restaurantImagesUrls = Array.isArray(user.restaurant_images)
    ? [...user.restaurant_images]
    : [];

  if (logo) {
    restaurantLogo = await uploadBufferToCloudinary(
      logo.buffer,
      `merchants/${merchantId}`,
      `logo_${logo.originalname}`,
      logo.mimetype
    );
  }
  if (restaurantImages && Array.isArray(restaurantImages)) {
    for (const img of restaurantImages) {
      const url = await uploadBufferToCloudinary(
        img.buffer,
        `merchants/${merchantId}`,
        `restaurant_${img.originalname}`,
        img.mimetype
      );
      restaurantImagesUrls.push(url);
    }
  }

  const regions = getRegionsObject(user);
  await user.update({
    restaurant_logo: restaurantLogo,
    restaurant_images: restaurantImagesUrls,
    approval_status: APPROVAL.PENDING,
    regions: {
      ...regions,
      signup_step: SIGNUP_STEPS.COMPLETE,
    },
  });
}

async function completeSignup({ merchantId }) {
  const user = await User.findByPk(merchantId);
  if (!user) throw new Error('Merchant not found');
  const regions = getRegionsObject(user);
  await user.update({
    approval_status: APPROVAL.PENDING,
    regions: {
      ...regions,
      signup_step: SIGNUP_STEPS.COMPLETE,
    },
  });
  await user.reload();
  return {
    ...buildSignupProgress(user),
    approval_status: user.approval_status,
    approvalStatus: mapApprovalStatus(user.approval_status),
    pendingReviewMessage:
      'Your restaurant is under review. We will notify you once an admin verifies your account.',
  };
}

async function getSignupProgress({ email, merchantId }) {
  let user = null;
  if (merchantId) {
    user = await User.findByPk(merchantId);
  } else if (email) {
    user = await User.findOne({
      where: {
        email: String(email).trim().toLowerCase(),
        type: 'Merchant',
      },
    });
  }
  if (!user) return null;
  return buildSignupProgress(user);
}

async function saveCard({ merchantId, cardNumber, expiry, cvv }) {
  const user = await User.findByPk(merchantId);
  if (!user) throw new Error('Merchant not found');
  const payment_cards = Array.isArray(user.payment_cards) ? [...user.payment_cards] : [];
  payment_cards.push({ cardNumber, expiry, cvv }); // demo only; do NOT store raw data in prod
  await user.update({ payment_cards });
}

async function login({ email, password }) {
  const user = await User.findOne({
    where: {
      email: String(email || '').trim().toLowerCase(),
      type: 'Merchant',
    },
  });
  if (!user) throw new Error('Invalid credentials');
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid credentials');

  const progress = buildSignupProgress(user);
  if (!progress.completed) {
    const error = new Error('Please finish creating your account');
    error.code = 'SIGNUP_INCOMPLETE';
    error.signupProgress = progress;
    throw error;
  }

  if (user.approval_status === APPROVAL.DISABLED) {
    throw new Error('Your restaurant account has been suspended. Please contact support.');
  }

  const normalized = normalizeUserResponse(user);
  return {
    ...normalized,
    approval_status: user.approval_status ?? APPROVAL.PENDING,
    approvalStatus: mapApprovalStatus(user.approval_status),
  };
}

async function getApprovalStatus(merchantId) {
  const user = await User.findOne({
    where: { id: merchantId, type: 'Merchant' },
    attributes: ['id', 'approval_status', 'restaurant_name', 'date_approved'],
  });
  if (!user) throw new Error('Merchant not found');
  return {
    id: user.id,
    restaurant_name: user.restaurant_name,
    approval_status: user.approval_status ?? APPROVAL.PENDING,
    approvalStatus: mapApprovalStatus(user.approval_status),
    date_approved: user.date_approved,
  };
}

async function approveRestaurant(restaurantId) {
  const user = await User.findOne({
    where: { id: restaurantId, type: 'Merchant' },
  });
  if (!user) throw new Error('Restaurant not found');

  const progress = buildSignupProgress(user);
  if (!progress.completed) {
    throw new Error('This restaurant has not finished signup yet');
  }

  if (user.approval_status === APPROVAL.APPROVED) {
    return {
      id: user.id,
      restaurant_name: user.restaurant_name,
      approval_status: APPROVAL.APPROVED,
      approvalStatus: 'active',
      date_approved: user.date_approved,
      alreadyApproved: true,
    };
  }

  await user.update({
    approval_status: APPROVAL.APPROVED,
    date_approved: new Date(),
  });

  return {
    id: user.id,
    restaurant_name: user.restaurant_name,
    approval_status: APPROVAL.APPROVED,
    approvalStatus: 'active',
    date_approved: user.date_approved,
    alreadyApproved: false,
  };
}

async function disableRestaurant(restaurantId) {
  const user = await User.findOne({
    where: { id: restaurantId, type: 'Merchant' },
  });
  if (!user) throw new Error('Restaurant not found');

  if (user.approval_status === APPROVAL.DISABLED) {
    return {
      id: user.id,
      restaurant_name: user.restaurant_name,
      approval_status: APPROVAL.DISABLED,
      approvalStatus: 'disabled',
      alreadyDisabled: true,
    };
  }

  await user.update({
    approval_status: APPROVAL.DISABLED,
    date_approved: null,
  });

  return {
    id: user.id,
    restaurant_name: user.restaurant_name,
    approval_status: APPROVAL.DISABLED,
    approvalStatus: 'disabled',
    alreadyDisabled: false,
  };
}

async function findMerchantByEmail(email) {
  const user = await User.findOne({ 
    where: { 
      email: email.toLowerCase(),
      type: 'Merchant'
    } 
  });
  return user ? normalizeUserResponse(user) : null;
}


async function merchantStatistics(merchantId) {
  if (!merchantId) throw new Error('merchantId is required');
  const { start, end } = getTodayRange();

  // Today aggregates
  const [issuedTodayRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: {
      restaurant_id: merchantId,
      type: 'issue',
      status: 'completed',
      date_used: { [Op.between]: [start, end] },
    },
    raw: true,
  });
  const [redeemedTodayRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: {
      restaurant_id: merchantId,
      type: 'redeem',
      status: 'completed',
      date_used: { [Op.between]: [start, end] },
    },
    raw: true,
  });
  const visitsToday = await Points.count({
    where: {
      restaurant_id: merchantId,
      status: 'completed',
      date_used: { [Op.between]: [start, end] },
    },
  });

  // All-time aggregates
  const allTimeVisits = await Points.count({
    where: { restaurant_id: merchantId, status: 'completed' },
  });
  const [issuedAllRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: { restaurant_id: merchantId, type: 'issue', status: 'completed' },
    raw: true,
  });
  const [redeemedAllRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: { restaurant_id: merchantId, type: 'redeem', status: 'completed' },
    raw: true,
  });

  // Recent 5 transactions
  const recent = await Points.findAll({
    where: { restaurant_id: merchantId, status: 'completed' },
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
  };
}

async function getRestaurants(page = 1, limit = 10, statusFilter = 'all') {
  const offset = (page - 1) * limit;
  const merchantBaseWhere = { type: 'Merchant' };

  const allCount = await User.count({ where: merchantBaseWhere });

  const activeCount = await User.count({
    where: {
      ...merchantBaseWhere,
      approval_status: APPROVAL.APPROVED,
    },
  });

  const pendingCount = await User.count({
    where: {
      ...merchantBaseWhere,
      ...pendingApprovalWhere(),
    },
  });

  const disabledCount = await User.count({
    where: {
      ...merchantBaseWhere,
      approval_status: APPROVAL.DISABLED,
    },
  });

  const overLimitCount = await User.count({
    where: {
      ...merchantBaseWhere,
      points_blocked: true,
    },
  });

  const paymentFailedCount = await User.count({
    where: {
      ...merchantBaseWhere,
      payment_failed: true,
    },
  });

  const noCardCount = await User.count({
    where: {
      ...merchantBaseWhere,
      ...merchantStatusWhere('no_card'),
    },
  });

  const listWhere = {
    ...merchantBaseWhere,
    ...merchantStatusWhere(statusFilter),
  };

  const filteredCount = await User.count({ where: listWhere });

  const restaurants = await User.findAll({
    where: listWhere,
    attributes: [
      'id',
      'restaurant_name',
      'email',
      'phone',
      'approval_status',
      'date_created',
      'date_approved',
      'regions',
      'points_blocked',
      'payment_failed',
      'default_payment_card_id',
    ],
    order: [['date_created', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
    raw: true,
  });

  const formattedRestaurants = restaurants.map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.restaurant_name,
    location: restaurant.regions?.address?.location || 'Not specified',
    status: mapApprovalStatus(restaurant.approval_status),
    email: restaurant.email,
    phone: restaurant.phone,
    dateCreated: restaurant.date_created,
    dateApproved: restaurant.date_approved,
    pointsBlocked: !!restaurant.points_blocked,
    paymentFailed: !!restaurant.payment_failed,
    hasCard: !!restaurant.default_payment_card_id,
    flags: [
      restaurant.points_blocked ? 'over_limit' : null,
      !restaurant.default_payment_card_id ? 'no_card' : null,
      restaurant.payment_failed ? 'payment_failed' : null,
    ].filter(Boolean),
  }));

  return {
    statistics: {
      all: allCount,
      active: activeCount,
      pending: pendingCount,
      disabled: disabledCount,
      over_limit: overLimitCount,
      no_card: noCardCount,
      payment_failed: paymentFailedCount,
    },
    restaurants: formattedRestaurants,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(filteredCount / limit) || 1,
      totalItems: filteredCount,
      itemsPerPage: parseInt(limit),
    },
  };
}

async function getRestaurantDetails(restaurantId) {
  if (!restaurantId) throw new Error('restaurantId is required');

  // Get restaurant details
  const restaurant = await User.findByPk(restaurantId, {
    where: { type: 'Merchant' },
    attributes: [
      'id',
      'restaurant_name',
      'email',
      'phone',
      'regions',
      'approval_status',
      'restaurant_logo'
    ],
    raw: true
  });

  if (!restaurant) {
    throw new Error('Restaurant not found');
  }

  // Get current month date range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Unique customers with completed visits
  const uniqueCustomers = await Points.findAll({
    attributes: [[fn('COUNT', fn('DISTINCT', col('customer_id'))), 'count']],
    where: {
      restaurant_id: restaurantId,
      status: 'completed',
      customer_id: { [Op.ne]: null },
    },
    raw: true,
  });
  const totalVisits = Number(uniqueCustomers[0]?.count || 0);

  // Get total points issued
  const [totalPointsRow] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: {
      restaurant_id: restaurantId,
      type: 'issue',
      status: 'completed'
    },
    raw: true
  });

  // Get points graph data for current month
  const pointsGraphData = await Points.findAll({
    attributes: [
      [fn('DATE', col('date_used')), 'date'],
      [fn('COALESCE', fn('SUM', literal("CASE WHEN type = 'issue' THEN total_points ELSE 0 END")), 0), 'no_of_points_issued'],
      [fn('COALESCE', fn('SUM', literal("CASE WHEN type = 'redeem' THEN total_points ELSE 0 END")), 0), 'no_of_points_redeemed']
    ],
    where: {
      restaurant_id: restaurantId,
      status: 'completed',
      date_used: {
        [Op.between]: [startOfMonth, endOfMonth]
      }
    },
    group: [fn('DATE', col('date_used'))],
    order: [[fn('DATE', col('date_used')), 'ASC']],
    raw: true
  });

  // Format points graph data
  const formattedPointsGraph = pointsGraphData.map(item => ({
    date: item.date,
    no_of_points_issued: Number(item.no_of_points_issued || 0),
    no_of_points_redeemed: Number(item.no_of_points_redeemed || 0)
  }));

  // Format restaurant details
  const details = {
    id: restaurant.id,
    restaurant_name: restaurant.restaurant_name,
    email: restaurant.email,
    phone: restaurant.phone,
    logo:restaurant.restaurant_logo,
    website: restaurant.website || 'Not specified',
    address: restaurant.regions?.address?.location || 'Not specified'
  };

  // Format analytics
  const analytics = {
    total_visits: totalVisits,
    total_points: Number(totalPointsRow?.sum || 0),
    points_graph: formattedPointsGraph
  };

  return {
    details,
    analytics
  };
}

async function updateMerchantPassword(merchantId, currentPassword, newPassword) {
  try {
    // Validate input
    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required');
    }

    // Find merchant
    const merchant = await User.findOne({
      where: {
        id: merchantId,
        type: 'Merchant'
      }
    });

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, merchant.password);
    
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await merchant.update({
      password: hashedNewPassword
    });

    return {
      success: true,
      message: 'Password updated successfully'
    };

  } catch (error) {
    console.error('Update merchant password error:', error);
    throw error;
  }
}

async function resetMerchantPassword(merchantId, newPassword) {
  try {
    // Validate input
    if (!newPassword) {
      throw new Error('New password is required');
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Find merchant
    const merchant = await User.findOne({
      where: {
        id: merchantId,
        type: 'Merchant'
      }
    });

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await merchant.update({
      password: hashedNewPassword
    });

    return {
      success: true,
      message: 'Password reset successfully'
    };

  } catch (error) {
    console.error('Reset merchant password error:', error);
    throw error;
  }
}

async function updateMerchantProfile({ userId, name, email, phone, restaurantName, dateOfBirth, gender, profileImageFile }) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Merchant not found');
    }

    if (user.type !== 'Merchant') {
      throw new Error('User is not a merchant');
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (restaurantName) updateData.restaurant_name = restaurantName;
    if (dateOfBirth) updateData.date_of_birth = dateOfBirth;
    if (gender) updateData.gender = gender;

    // Handle profile image upload to Cloudinary
    if (profileImageFile) {
      try {
        const imageUrl = await uploadBufferToCloudinary(
          profileImageFile.buffer,
          'merchant-profiles',
          `profile-${userId}-${Date.now()}`,
          profileImageFile.mimetype
        );
        updateData.profile_image = imageUrl;
        // Also update restaurant_logo if it's the profile image
       
        updateData.restaurant_logo = imageUrl;
        
      } catch (uploadError) {
        console.error('Error uploading profile image to Cloudinary:', uploadError);
        throw new Error('Failed to upload profile image');
      }
    }

    await user.update(updateData);

    return normalizeUserResponse(user);
  } catch (error) {
    console.log({ error, message: 'failed to update merchant profile' });
    throw new Error(`Failed to update merchant profile: ${error.message}`);
  }
}

module.exports = {
  saveDetails,
  saveAddress,
  savePictures,
  saveCard,
  completeSignup,
  getSignupProgress,
  login,
  findMerchantByEmail,
  merchantStatistics,
  updateMerchantProfile,
  updateMerchantPassword,
  resetMerchantPassword,
  getRestaurants,
  getRestaurantDetails,
  getApprovalStatus,
  approveRestaurant,
  disableRestaurant,
  mapApprovalStatus,
};
