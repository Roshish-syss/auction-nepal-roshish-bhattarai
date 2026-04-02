const Notification = require('../models/Notification');

let ioInstance = null;

function setNotificationIo(io) {
  ioInstance = io;
}

function roomForUser(userId) {
  return `user_${String(userId)}`;
}

async function getUnreadCount(userId) {
  return Notification.countDocuments({
    userId,
    read: false
  });
}

/**
 * Emit new notification + current unread count to the user's socket room (same as chat: user_<id>).
 */
async function emitNotificationNew(userId, notificationDoc) {
  if (!ioInstance) return;
  const uid = String(userId);
  const plain = notificationDoc.toObject ? notificationDoc.toObject() : { ...notificationDoc };
  const count = await getUnreadCount(uid);
  ioInstance.to(roomForUser(uid)).emit('notification_new', {
    notification: plain,
    unreadCount: count
  });
}

async function emitUnreadCountForUser(userId) {
  if (!ioInstance) return;
  const uid = String(userId);
  const count = await getUnreadCount(uid);
  ioInstance.to(roomForUser(uid)).emit('notification_unread_count', { count });
}

module.exports = {
  setNotificationIo,
  emitNotificationNew,
  emitUnreadCountForUser,
  getUnreadCount
};
