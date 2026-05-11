import Notification from "../models/Notification.js";
import AppError from "../utils/AppError.js";

export async function createNotification({ userId, message, type = "system" }) {
  if (!userId || !message) return null;

  return Notification.create({
    user: userId,
    message,
    type,
  });
}

export async function getNotifications(userId) {
  return Notification.find({ user: userId }).sort({ createdAt: -1 });
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await Notification.findOne({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  notification.read = true;
  await notification.save();

  return notification;
}

export async function countUnreadNotifications(userId) {
  return Notification.countDocuments({
    user: userId,
    read: false,
  });
}
