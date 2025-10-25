const merchantService = require('../services/merchantService');

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
