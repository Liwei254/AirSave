import { isPostgresDataStoreEnabled } from "../config/dataStore.js";
import Notification from "../models/Notification.js";
import AppError from "../utils/AppError.js";
import {
  decrementUnreadNotificationCount,
  getUnreadNotificationCount,
  incrementUnreadNotificationCount,
  setUnreadNotificationCount,
} from "./cacheService.js";
import * as prismaNotificationService from "./postgres/prismaNotificationService.js";

export async function createNotification({ userId, message, type = "system", sourceEventId = null }) {
  if (isPostgresDataStoreEnabled()) {
    return prismaNotificationService.createNotification({ userId, message, type, sourceEventId });
  }

  if (!userId || !message) return null;

  const notification = await Notification.create({
    user: userId,
    message,
    type,
  });

  await incrementUnreadNotificationCount(userId);
  return notification;
}

export async function getNotifications(userId, filters = {}) {
  if (isPostgresDataStoreEnabled()) {
    return prismaNotificationService.getNotifications(userId, filters);
  }

  return Notification.find({ user: userId }).sort({ createdAt: -1 });
}

export async function markNotificationRead(userId, notificationId) {
  if (isPostgresDataStoreEnabled()) {
    return prismaNotificationService.markNotificationRead(userId, notificationId);
  }

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
  if (isPostgresDataStoreEnabled()) {
    return prismaNotificationService.countUnreadNotifications(userId);
  }

  const cachedCount = await getUnreadNotificationCount(userId);
  if (cachedCount !== null) return cachedCount;

  const count = await Notification.countDocuments({
    user: userId,
    read: false,
  });
  await setUnreadNotificationCount(userId, count);

  return count;
}

export async function markAllNotificationsRead(userId) {
  if (isPostgresDataStoreEnabled()) {
    return prismaNotificationService.markAllNotificationsRead(userId);
  }

  await Notification.updateMany({ user: userId, read: false }, { read: true });
  await setUnreadNotificationCount(userId, 0);
  return getNotifications(userId);
}

export async function deleteNotification(userId, notificationId) {
  if (isPostgresDataStoreEnabled()) {
    return prismaNotificationService.deleteNotification(userId, notificationId);
  }

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  if (!notification.read) {
    await decrementUnreadNotificationCount(userId);
  }

  return notification;
}
