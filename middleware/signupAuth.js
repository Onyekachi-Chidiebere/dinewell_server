const jwt = require('jsonwebtoken');

function issueSignupToken(merchantId) {
  const secret = process.env.SIGNUP_TOKEN_SECRET || process.env.JSON_WEB_SECRET;
  if (!secret) throw new Error('SIGNUP_TOKEN_SECRET or JSON_WEB_SECRET is required');
  return jwt.sign(
    { sub: String(merchantId), merchantId: Number(merchantId), tokenType: 'merchant-signup' },
    secret,
    { expiresIn: process.env.SIGNUP_TOKEN_TTL || '30m', issuer: 'dinewell' }
  );
}

function requireSignupToken(req, res, next) {
  const raw = req.headers['x-signup-token']
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    || req.body?.signupToken
    || req.query?.signupToken;
  if (!raw && process.env.NODE_ENV !== 'production') {
    req.signup = { merchantId: Number(req.body?.merchantId || req.query?.merchantId) };
    return next();
  }
  try {
    const decoded = jwt.verify(raw, process.env.SIGNUP_TOKEN_SECRET || process.env.JSON_WEB_SECRET, {
      issuer: 'dinewell',
    });
    if (decoded.tokenType !== 'merchant-signup') throw new Error('Wrong token type');
    const supplied = req.body?.merchantId || req.query?.merchantId;
    if (supplied && Number(supplied) !== Number(decoded.merchantId)) {
      return res.status(403).json({ error: 'Signup token does not match merchant' });
    }
    req.signup = { merchantId: Number(decoded.merchantId) };
    if (req.body) req.body.merchantId = Number(decoded.merchantId);
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'Valid signupToken required' });
  }
}

module.exports = { issueSignupToken, requireSignupToken };
