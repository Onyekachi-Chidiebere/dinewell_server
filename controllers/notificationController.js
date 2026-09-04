const notificationService = require('../services/notificationService');
const deviceTokenService = require('../services/deviceTokenService');

exports.getPreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await notificationService.getPreferences(parseInt(userId, 10));
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await notificationService.updatePreferences(
      parseInt(userId, 10),
      req.body || {}
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.listNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const data = await notificationService.listNotifications(
      parseInt(userId, 10),
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await notificationService.getUnreadCount(parseInt(userId, 10));
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    const data = await notificationService.markAsRead(
      parseInt(userId, 10),
      parseInt(notificationId, 10)
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await notificationService.markAllAsRead(parseInt(userId, 10));
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.registerDeviceToken = async (req, res) => {
  try {
    const { userId } = req.params;
    const { token, platform, app } = req.body || {};
    const data = await deviceTokenService.upsertDeviceToken({
      userId: parseInt(userId, 10),
      token,
      platform,
      app,
    });
    res.json({ success: true, data: { id: data.id } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.removeDeviceToken = async (req, res) => {
  try {
    const { userId } = req.params;
    const { token } = req.body || {};
    const data = await deviceTokenService.removeDeviceToken({
      userId: parseInt(userId, 10),
      token,
    });
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
