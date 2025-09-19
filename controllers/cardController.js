const cardService = require('../services/cardService');

exports.addCard = async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.body;
    const card = await cardService.addCard({ userId, paymentMethodId });
    res.status(201).json(card);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.setDefault = async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.body;
    const result = await cardService.setDefaultCard({ userId, paymentMethodId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.charge = async (req, res) => {
  try {
    const { userId, amount, currency, paymentMethodId } = req.body;
    const pi = await cardService.charge({ userId, amount, currency, paymentMethodId });
    res.json(pi);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { userId } = req.query;
    const cards = await cardService.listCards({ userId });
    res.json(cards);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
