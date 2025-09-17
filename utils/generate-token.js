const jwt = require('jsonwebtoken');
/**
 * This handles generating token for users;
 */
const generateToken = (user) =>{
 try {
  const ACCESS_TOKEN_SECRET = process.env.JSON_WEB_SECRET;
  const REFRESH_TOKEN_SECRET = process.env.JSON_WEB_REFRESH_SECRET; 
    // Generate an access token that expires in 15 minutes
    const accessToken = jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });

    // Generate a refresh token that expires in 2hrs
    const refreshToken = jwt.sign(user, REFRESH_TOKEN_SECRET, { expiresIn: '2h' });
    return { accessToken, refreshToken };
 } catch (error) {
 }
};

module.exports = generateToken;