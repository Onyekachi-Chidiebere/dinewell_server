const { issueTokenPair } = require('../services/authService');

const generateToken = (user) => issueTokenPair(user);

module.exports = generateToken;