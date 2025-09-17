const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/user');

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

module.exports = {
  saveDetails,
  saveAddress,
  savePictures,
  saveCard,
  login,
};
