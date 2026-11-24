function validateBootstrapInput(env) {
  const email = String(env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(env.BOOTSTRAP_ADMIN_PASSWORD || '');
  const token = String(env.ADMIN_BOOTSTRAP_TOKEN || '');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address');
  }
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters with upper, lower, and numeric characters');
  }
  if (token.length < 32) {
    throw new Error('ADMIN_BOOTSTRAP_TOKEN must contain at least 32 characters');
  }
  return {
    email,
    password,
    token,
    allowAdditionalAdmin: env.ALLOW_ADDITIONAL_ADMIN === 'true',
  };
}

function assertBootstrapAllowed({ adminCount, allowAdditionalAdmin, tokenAlreadyUsed, emailAlreadyUsed }) {
  if (tokenAlreadyUsed) throw new Error('ADMIN_BOOTSTRAP_TOKEN has already been consumed');
  if (emailAlreadyUsed) throw new Error('BOOTSTRAP_ADMIN_EMAIL is already in use');
  if (adminCount > 0 && !allowAdditionalAdmin) {
    throw new Error('An admin already exists; set ALLOW_ADDITIONAL_ADMIN=true only for an intentional additional admin');
  }
  return true;
}

module.exports = { validateBootstrapInput, assertBootstrapAllowed };
