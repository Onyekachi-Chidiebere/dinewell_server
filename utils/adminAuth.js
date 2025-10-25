const jwt = require('jsonwebtoken');
const User = require('../models/user');

/**
 * Middleware to verify admin authentication
 * Ensures the user is logged in and has admin type
 */
const adminAuth = async (req, res, next) => {
  try {
    // Get token from request header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No access token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with secret key
    const decoded = jwt.verify(token, process.env.JSON_WEB_SECRET);

    // Check if user exists and is admin
    const user = await User.findOne({
      where: {
        id: decoded.id,
        type: 'admin'
      }
    });

    if (!user) {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    // Check if admin is approved
    if (user.approval_status !== 1) {
      return res.status(403).json({
        error: 'Admin account not approved'
      });
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      type: user.type
    };

    next();
  } catch (error) {
    console.log({error})
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    console.error('Admin auth error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

module.exports = adminAuth;
