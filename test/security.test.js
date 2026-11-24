const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JSON_WEB_SECRET = process.env.JSON_WEB_SECRET || 'test-access-secret';
process.env.JSON_WEB_REFRESH_SECRET = process.env.JSON_WEB_REFRESH_SECRET || 'test-refresh-secret';
process.env.RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET || 'test-reset-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
process.env.DB_SSL = 'false';

const { authorizeRoles, resolveSelfParam, requireOwnership } = require('../middleware/auth');
const { decodeResetToken } = require('../utils/otpService');
const merchantService = require('../services/merchantService');
const merchantController = require('../controllers/merchantController');
const { signAccessToken } = require('../services/authService');

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('role authorization rejects the wrong role', () => {
  const req = { auth: { role: 'customer', userId: 4 } };
  const res = response();
  let called = false;
  authorizeRoles('merchant')(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
});

test('access tokens used by admin auth carry the required issuer and audience', () => {
  const token = signAccessToken({ id: 9, type: 'admin' });
  const claims = jwt.verify(token, process.env.JSON_WEB_SECRET, {
    issuer: 'dinewell',
    audience: 'dinewell-api',
  });
  assert.equal(claims.sub, '9');
  assert.equal(claims.role, 'admin');
});

test('ownership middleware rejects caller-selected IDs', () => {
  const req = { auth: { role: 'customer', userId: 4 }, params: { userId: '5' } };
  const res = response();
  let called = false;
  requireOwnership(['params', 'userId'])(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
});

test('self parameter is bound to the authenticated subject before ownership checks', () => {
  const req = { auth: { role: 'merchant', userId: 4 }, params: { merchantId: 'me' } };
  let resolved = false;
  resolveSelfParam('merchantId')(req, response(), () => { resolved = true; });
  assert.equal(resolved, true);
  assert.equal(req.params.merchantId, '4');

  let owned = false;
  requireOwnership(['params', 'merchantId'])(req, response(), () => { owned = true; });
  assert.equal(owned, true);
});

test('merchant signup details and incomplete login both return continuation tokens', async () => {
  const originalSaveDetails = merchantService.saveDetails;
  const originalLogin = merchantService.login;
  try {
    merchantService.saveDetails = async () => ({
      merchantId: 17,
      signupStep: 'address',
      nextScreen: 'RestaurantAddress',
    });
    const detailsRes = response();
    await merchantController.signupDetails({ body: {} }, detailsRes);
    assert.equal(typeof detailsRes.payload.signupToken, 'string');

    merchantService.login = async () => {
      const error = new Error('Please finish creating your account');
      error.code = 'SIGNUP_INCOMPLETE';
      error.signupProgress = { merchantId: 17, signupStep: 'pictures' };
      throw error;
    };
    const loginRes = response();
    await merchantController.login({ body: {} }, loginRes);
    assert.equal(loginRes.statusCode, 403);
    assert.equal(loginRes.payload.code, 'SIGNUP_INCOMPLETE');
    assert.equal(typeof loginRes.payload.signupToken, 'string');
  } finally {
    merchantService.saveDetails = originalSaveDetails;
    merchantService.login = originalLogin;
  }
});

test('password reset tokens are bound to account type and email claims', () => {
  const token = jwt.sign({
    sub: '42',
    email: 'person@example.com',
    type: 'Customer',
    tokenType: 'password-reset',
    jti: 'one-use-id',
  }, process.env.RESET_TOKEN_SECRET, { expiresIn: '5m', issuer: 'dinewell' });
  assert.equal(decodeResetToken(token, 'Merchant'), null);
  const claims = decodeResetToken(token, 'Customer');
  assert.equal(claims.sub, '42');
  assert.equal(claims.email, 'person@example.com');
});
