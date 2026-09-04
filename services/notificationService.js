const Notification = require('../models/notification');
const User = require('../models/user');
const deviceTokenService = require('./deviceTokenService');

async function getPreferences(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'app_notifications', 'email_notifications'],
  });
  if (!user) throw new Error('User not found');

  return {
    appNotifications: user.app_notifications !== false,
    emailNotifications: !!user.email_notifications,
  };
}

async function updatePreferences(userId, updates = {}) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  const next = {};
  if (updates.appNotifications !== undefined) {
    next.app_notifications = !!updates.appNotifications;
  }
  if (updates.emailNotifications !== undefined) {
    next.email_notifications = !!updates.emailNotifications;
  }

  if (Object.keys(next).length > 0) {
    await user.update(next);
  }

  // If app notifications turned off, clear device tokens so we stop pushing
  if (updates.appNotifications === false) {
    await deviceTokenService.removeAllDeviceTokens(userId);
  }

  return getPreferences(userId);
}

/**
 * Create an in-app notification if the user has app notifications enabled.
 * Also sends an FCM push when device tokens exist.
 * Never throws to callers — failures are logged so business flows stay intact.
 */
async function createNotification({
  userId,
  title,
  body,
  type = 'general',
  data = {},
  respectPreferences = true,
}) {
  try {
    if (!userId || !title || !body) return null;

    if (respectPreferences) {
      const prefs = await getPreferences(userId);
      if (!prefs.appNotifications) return null;
    }

    const notification = await Notification.create({
      user_id: userId,
      title,
      body,
      type,
      data,
      is_read: false,
      date_created: new Date(),
    });

    // Fire-and-forget push (does not block inbox create)
    deviceTokenService
      .sendPushToUser(userId, {
        title,
        body,
        data: {
          type,
          notificationId: String(notification.id),
          ...(data || {}),
        },
      })
      .catch((err) => console.error('push send error:', err.message));

    return notification;
  } catch (error) {
    console.error('createNotification error:', error.message);
    return null;
  }
}

async function listNotifications(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const { rows, count } = await Notification.findAndCountAll({
    where: { user_id: userId },
    order: [['date_created', 'DESC']],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });

  const unreadCount = await Notification.count({
    where: { user_id: userId, is_read: false },
  });

  return {
    notifications: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      data: n.data || {},
      isRead: n.is_read,
      dateCreated: n.date_created,
    })),
    unreadCount,
    pagination: {
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(count / limit) || 1,
      totalItems: count,
      itemsPerPage: parseInt(limit, 10),
    },
  };
}

async function getUnreadCount(userId) {
  const unreadCount = await Notification.count({
    where: { user_id: userId, is_read: false },
  });
  return { unreadCount };
}

async function markAsRead(userId, notificationId) {
  const notification = await Notification.findOne({
    where: { id: notificationId, user_id: userId },
  });
  if (!notification) throw new Error('Notification not found');

  if (!notification.is_read) {
    await notification.update({ is_read: true });
  }

  return {
    id: notification.id,
    isRead: true,
  };
}

async function markAllAsRead(userId) {
  await Notification.update(
    { is_read: true },
    { where: { user_id: userId, is_read: false } }
  );
  return { success: true };
}

module.exports = {
  getPreferences,
  updatePreferences,
  createNotification,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
