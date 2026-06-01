import {
  createNotification as createNotificationRecord,
  deleteNotification as deleteNotificationRecord,
  getUnreadCount,
  listNotificationsByUser,
  markAllAsRead as markAllAsReadRecord,
  markAsRead,
} from "../../repositories/postgres/prismaNotificationRepository.js";
import AppError from "../../utils/AppError.js";

function serializeNotification(notification) {
  if (!notification) return null;

  return {
    ...notification,
    id: notification.id,
    _id: notification.id,
    user: notification.userId,
  };
}

function normalizeFilters(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || filters.take || 50), 1), 100);
  const page = Math.max(Number(filters.page || 1), 1);
  const skip = typeof filters.skip !== "undefined" ? Math.max(Number(filters.skip || 0), 0) : (page - 1) * limit;
  const normalizedFilters = {
    limit,
    take: limit,
    skip,
  };

  if (typeof filters.read !== "undefined") {
    normalizedFilters.read = filters.read === true || filters.read === "true";
  }

  if (filters.unread === true || filters.unread === "true") {
    normalizedFilters.unread = true;
  }

  return normalizedFilters;
}

export async function createNotification({ userId, message, type = "system", sourceEventId = null, read = false } = {}, tx) {
  if (!userId || !String(message || "").trim()) return null;

  const notification = await createNotificationRecord(
    userId,
    {
      message,
      type,
      read,
      sourceEventId,
    },
    tx
  );

  return serializeNotification(notification);
}

export async function getNotifications(userId, filters = {}, tx) {
  const notifications = await listNotificationsByUser(userId, normalizeFilters(filters), tx);
  return notifications.map(serializeNotification);
}

export async function countUnreadNotifications(userId, tx) {
  return getUnreadCount(userId, tx);
}

export async function markNotificationRead(userId, notificationId, tx) {
  const notification = await markAsRead(userId, notificationId, tx);

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  return serializeNotification(notification);
}

export async function markAllNotificationsRead(userId, tx) {
  const notifications = await markAllAsReadRecord(userId, tx);
  return notifications.map(serializeNotification);
}

export async function deleteNotification(userId, notificationId, tx) {
  const notification = await deleteNotificationRecord(userId, notificationId, tx);

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  return serializeNotification(notification);
}
