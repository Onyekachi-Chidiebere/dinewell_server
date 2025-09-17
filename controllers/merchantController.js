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
    res.json({ merchant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
