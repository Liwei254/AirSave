import Notification from "../models/Notification.js";
import AppError from "../utils/AppError.js";
import {
  decrementUnreadNotificationCount,
  getUnreadNotificationCount,
  incrementUnreadNotificationCount,
  setUnreadNotificationCount,
} from "./cacheService.js";

export async function createNotification({ userId, message, type = "system" }) {
  if (!userId || !message) return null;

  const notification = await Notification.create({
    user: userId,
    message,
    type,
  });

  await incrementUnreadNotificationCount(userId);
  return notification;
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

  const wasUnread = !notification.read;
  notification.read = true;
  await notification.save();
  if (wasUnread) {
    await decrementUnreadNotificationCount(userId);
  }

  return notification;
}

export async function countUnreadNotifications(userId) {
  const cachedCount = await getUnreadNotificationCount(userId);
  if (cachedCount !== null) return cachedCount;

  const count = await Notification.countDocuments({
    user: userId,
    read: false,
  });
  await setUnreadNotificationCount(userId, count);

  return count;
}
