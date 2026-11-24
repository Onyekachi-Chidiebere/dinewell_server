const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Points = require('../models/points');
const Dish = require('../models/dish');

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JSON_WEB_SECRET, {
      issuer: 'dinewell',
      audience: 'dinewell-api',
    });
    const userId = Number(decoded.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0 || (decoded.userId && Number(decoded.userId) !== userId)) {
      return res.status(401).json({ error: 'Invalid access token subject' });
    }
    const user = await User.findByPk(userId);
    if (!user || user.approval_status === -1) {
      return res.status(401).json({ error: 'Account unavailable' });
    }
    const currentRole = normalizeRole(user.type);
    if (currentRole === 'admin' && user.approval_status !== 1) {
      return res.status(403).json({ error: 'Admin account not approved' });
    }
    req.auth = {
      userId,
      sub: String(userId),
      role: currentRole,
      type: user.type,
      user,
    };
    req.user = { id: user.id, email: user.email, name: user.name, type: user.type };
    return next();
  } catch (error) {
    if (['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({
        error: error.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token',
      });
    }
    return next(error);
  }
}

function authorizeRoles(...roles) {
  const allowed = roles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.auth || !allowed.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

function resolveSelfParam(paramName) {
  return (req, _res, next) => {
    if (req.params?.[paramName] === 'me') {
      req.params[paramName] = String(req.auth.userId);
    }
    return next();
  };
}

function requireOwnership(...locations) {
  return (req, res, next) => {
    if (req.auth?.role === 'admin') return next();
    const supplied = locations
      .map(([source, key]) => req[source]?.[key])
      .find((value) => value !== undefined && value !== null && value !== '');
    if (supplied !== undefined && Number(supplied) !== req.auth?.userId) {
      return res.status(403).json({ error: 'Resource ownership required' });
    }
    return next();
  };
}

async function requirePointOwnership(req, res, next) {
  if (req.auth?.role === 'admin') return next();
  const point = await Points.findByPk(req.params.id);
  if (!point) return res.status(404).json({ error: 'Points transaction not found' });
  const owns = req.auth.role === 'merchant'
    ? Number(point.restaurant_id) === req.auth.userId
    : Number(point.customer_id) === req.auth.userId;
  if (!owns) return res.status(403).json({ error: 'Resource ownership required' });
  req.point = point;
  return next();
}

async function requireDishOwnership(req, res, next) {
  if (req.auth?.role === 'admin') return next();
  const dish = await Dish.findByPk(req.params.id);
  if (!dish) return res.status(404).json({ error: 'Dish not found' });
  const ownerId = dish.restaurant_id || dish.merchant_id || dish.user_id;
  if (Number(ownerId) !== req.auth?.userId) {
    return res.status(403).json({ error: 'Resource ownership required' });
  }
  req.dish = dish;
  return next();
}

module.exports = {
  authenticate,
  authorizeRoles,
  resolveSelfParam,
  requireOwnership,
  requirePointOwnership,
  requireDishOwnership,
  normalizeRole,
};
