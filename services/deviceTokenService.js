const DeviceToken = require('../models/deviceToken');
const { getFirebaseAdmin } = require('../utils/firebase');

async function upsertDeviceToken({ userId, token, platform = 'unknown', app = null }) {
  if (!userId || !token) throw new Error('userId and token are required');

  const existing = await DeviceToken.findOne({ where: { token } });
  if (existing) {
    await existing.update({
      user_id: userId,
      platform,
      app,
      date_updated: new Date(),
    });
    return existing;
  }

  return DeviceToken.create({
    user_id: userId,
    token,
    platform,
    app,
    date_updated: new Date(),
  });
}

async function removeDeviceToken({ userId, token }) {
  if (!userId || !token) throw new Error('userId and token are required');
  await DeviceToken.destroy({ where: { user_id: userId, token } });
  return { success: true };
}

async function removeAllDeviceTokens(userId) {
  await DeviceToken.destroy({ where: { user_id: userId } });
  return { success: true };
}

async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    const fb = getFirebaseAdmin();
    if (!fb) return { sent: 0, skipped: true };

    const tokens = await DeviceToken.findAll({ where: { user_id: userId } });
    if (!tokens.length) return { sent: 0 };

    const stringData = {};
    Object.entries(data || {}).forEach(([key, value]) => {
      stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    });

    const message = {
      notification: { title, body },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          channelId: 'dinewell_default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      tokens: tokens.map((t) => t.token),
    };

    const response = await fb.messaging().sendEachForMulticast(message);

    // Drop invalid tokens
    const invalid = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token')
        ) {
          invalid.push(tokens[idx].token);
        }
      }
    });

    if (invalid.length) {
      await DeviceToken.destroy({ where: { token: invalid } });
    }

    return {
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error('sendPushToUser error:', error.message);
    return { sent: 0, error: error.message };
  }
}

module.exports = {
  upsertDeviceToken,
  removeDeviceToken,
  removeAllDeviceTokens,
  sendPushToUser,
};
