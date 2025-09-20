const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Apple's public key endpoint
const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
});

/**
 * Get Apple's signing key
 * @param {string} kid - Key ID from JWT header
 * @returns {Promise<Object>} Public key
 */
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

/**
 * Verify Apple ID token and return user information
 * @param {string} idToken - Apple ID token from client
 * @returns {Object} User information from Apple
 */
async function verifyAppleToken(idToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        algorithms: ['RS256'],
        audience: process.env.APPLE_CLIENT_ID, // Your app's bundle ID
        issuer: 'https://appleid.apple.com',
      },
      (err, decoded) => {
        if (err) {
          reject(new Error(`Apple token verification failed: ${err.message}`));
          return;
        }

        // Extract user information from Apple token
        const userInfo = {
          appleId: decoded.sub,
          email: decoded.email,
          emailVerified: decoded.email_verified === 'true',
          // Note: Apple only sends name on first sign-in
          // For subsequent sign-ins, you'll need to store it
        };

        resolve(userInfo);
      }
    );
  });
}

module.exports = {
  verifyAppleToken,
};
