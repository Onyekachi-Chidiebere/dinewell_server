let admin = null;
let initAttempted = false;

function getFirebaseAdmin() {
  if (initAttempted) return admin;
  initAttempted = true;

  try {
    // eslint-disable-next-line global-require
    admin = require('firebase-admin');

    if (admin.apps.length > 0) {
      return admin;
    }

    const json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!json) {
      console.warn(
        'FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled until configured'
      );
      admin = null;
      return null;
    }

    const credentials = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });

    console.log('Firebase Admin initialized for FCM');
    return admin;
  } catch (error) {
    console.error('Firebase Admin init failed:', error.message);
    admin = null;
    return null;
  }
}

module.exports = { getFirebaseAdmin };
