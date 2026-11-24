const dotenv = require('dotenv');

dotenv.config({ quiet: true });

const PRODUCTION_REQUIRED = [
  'JSON_WEB_SECRET',
  'JSON_WEB_REFRESH_SECRET',
  'SIGNUP_TOKEN_SECRET',
  'RESET_TOKEN_SECRET',
  'ALLOWED_ORIGINS',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FIREBASE_SERVICE_ACCOUNT',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'APPLE_CLIENT_ID',
  'GOOGLE_CLIENT_ID',
];

const LEGACY_DATABASE_REQUIRED = [
  'DB',
  'DB_USER',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_PORT',
  'DB_DIALECT',
];

function missingProductionVariables(env = process.env) {
  const missing = PRODUCTION_REQUIRED.filter((name) => !String(env[name] || '').trim());
  if (!String(env.DATABASE_URL || '').trim()) {
    missing.push(...LEGACY_DATABASE_REQUIRED.filter((name) => !String(env[name] || '').trim()));
  }
  if (
    env.DB_SSL !== 'false'
    && env.DB_SSL_ALLOW_SYSTEM_CA !== 'true'
    && !String(env.DB_CA_CERT_PATH || '').trim()
  ) {
    missing.push('DB_CA_CERT_PATH (or DB_SSL_ALLOW_SYSTEM_CA=true)');
  }
  return missing;
}

function validateEnvironment(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const missing = missingProductionVariables(env);
  if (missing.length) {
    throw new Error(`Missing production environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  LEGACY_DATABASE_REQUIRED,
  PRODUCTION_REQUIRED,
  missingProductionVariables,
  validateEnvironment,
};
