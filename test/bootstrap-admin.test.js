const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBootstrapInput, assertBootstrapAllowed } = require('../utils/adminBootstrapPolicy');

const validEnvironment = {
  BOOTSTRAP_ADMIN_EMAIL: 'Admin@Example.com',
  BOOTSTRAP_ADMIN_PASSWORD: 'StrongPassword123',
  ADMIN_BOOTSTRAP_TOKEN: 'a'.repeat(32),
};

test('admin bootstrap requires strong explicit secrets', () => {
  assert.throws(() => validateBootstrapInput({}), /BOOTSTRAP_ADMIN_EMAIL/);
  assert.throws(
    () => validateBootstrapInput({ ...validEnvironment, BOOTSTRAP_ADMIN_PASSWORD: 'short' }),
    /at least 12 characters/
  );
  assert.throws(
    () => validateBootstrapInput({ ...validEnvironment, ADMIN_BOOTSTRAP_TOKEN: 'too-short' }),
    /at least 32 characters/
  );
  assert.equal(validateBootstrapInput(validEnvironment).email, 'admin@example.com');
});

test('admin bootstrap refuses existing admins without explicit override', () => {
  assert.throws(
    () => assertBootstrapAllowed({
      adminCount: 1,
      allowAdditionalAdmin: false,
      tokenAlreadyUsed: false,
      emailAlreadyUsed: false,
    }),
    /admin already exists/
  );
  assert.equal(assertBootstrapAllowed({
    adminCount: 1,
    allowAdditionalAdmin: true,
    tokenAlreadyUsed: false,
    emailAlreadyUsed: false,
  }), true);
});

test('admin bootstrap always refuses consumed tokens and duplicate email', () => {
  assert.throws(
    () => assertBootstrapAllowed({
      adminCount: 0,
      allowAdditionalAdmin: false,
      tokenAlreadyUsed: true,
      emailAlreadyUsed: false,
    }),
    /already been consumed/
  );
  assert.throws(
    () => assertBootstrapAllowed({
      adminCount: 0,
      allowAdditionalAdmin: false,
      tokenAlreadyUsed: false,
      emailAlreadyUsed: true,
    }),
    /already in use/
  );
});
