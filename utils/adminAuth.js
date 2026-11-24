const { authenticate, authorizeRoles } = require('../middleware/auth');

const adminOnly = authorizeRoles('admin');
const adminAuth = (req, res, next) => authenticate(req, res, (error) => {
  if (error) return next(error);
  return adminOnly(req, res, next);
});

module.exports = adminAuth;
