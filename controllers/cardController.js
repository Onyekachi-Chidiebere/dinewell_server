const cardService = require('../services/cardService');

exports.addCard = async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const card = await cardService.addCard({ userId: req.auth.userId, paymentMethodId });
    res.status(201).json(card);
  } catch (err) {
    console.log({ err })
    res.status(400).json({ error: err.message });
  }
};

exports.setDefault = async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const result = await cardService.setDefaultCard({ userId: req.auth.userId, paymentMethodId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.charge = async (req, res) => {
  res.status(410).json({ error: 'Direct card charging is disabled' });
};

exports.list = async (req, res) => {
  try {
    const cards = await cardService.listCards({ userId: req.auth.userId });
    res.json(cards);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
