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

async function saveDetails({ name, phone, email, location, password }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    restaurant_name: name,
    phone,
    email,
    password: hashedPassword,
    type: 'Merchant',
    date_created: new Date(),
    regions: { address: { location } },
  });
  return user.id;
}

async function saveAddress({ merchantId, streetNumber, streetName, area }) {
  const user = await User.findByPk(merchantId);
  if (!user) throw new Error('Merchant not found');
  const regions = user.regions || {};
  regions.address = { streetNumber, streetName, area };
  await user.update({ regions });
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

  await user.update({ restaurant_logo: restaurantLogo, restaurant_images: restaurantImagesUrls });
}

async function saveCard({ merchantId, cardNumber, expiry, cvv }) {
  const user = await User.findByPk(merchantId);
  if (!user) throw new Error('Merchant not found');
  const payment_cards = Array.isArray(user.payment_cards) ? [...user.payment_cards] : [];
  payment_cards.push({ cardNumber, expiry, cvv }); // demo only; do NOT store raw data in prod
  await user.update({ payment_cards });
}

async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new Error('Invalid credentials');
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid credentials');
  return normalizeUserResponse(user);
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
    where: { restaurant_id: merchantId },
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

module.exports = {
  saveDetails,
  saveAddress,
  savePictures,
  saveCard,
  login,
  merchantStatistics,
};
