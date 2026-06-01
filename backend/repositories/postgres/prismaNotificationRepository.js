import prisma from "../../config/prisma.js";

export async function createNotification(userId, data = {}, tx = prisma) {
  if (data.sourceEventId) {
    const existingNotification = await tx.notification.findUnique({
      where: {
        sourceEventId: String(data.sourceEventId),
      },
    });

    if (existingNotification) {
      return existingNotification;
    }
  }

  return tx.notification.create({
    data: {
      userId: String(userId),
      message: String(data.message || "").trim(),
      type: data.type || "system",
      read: Boolean(data.read || false),
      sourceEventId: data.sourceEventId ? String(data.sourceEventId) : null,
    },
  });
}

export async function listNotificationsByUser(userId, filters = {}, tx = prisma) {
  const where = {
    userId: String(userId),
  };

  if (typeof filters.read === "boolean") {
    where.read = filters.read;
  }

  if (filters.unread === true) {
    where.read = false;
  }

  return tx.notification.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip: filters.skip || 0,
    take: filters.take || filters.limit || 50,
  });
}

export async function getUnreadCount(userId, tx = prisma) {
  return tx.notification.count({
    where: {
      userId: String(userId),
      read: false,
    },
  });
}

export async function markAsRead(userId, notificationId, tx = prisma) {
  const notification = await tx.notification.findFirst({
    where: {
      id: String(notificationId),
      userId: String(userId),
    },
  });

  if (!notification) {
    return null;
  }

  return tx.notification.update({
    where: {
      id: notification.id,
    },
    data: {
      read: true,
    },
  });
}

export async function markAllAsRead(userId, tx = prisma) {
  await tx.notification.updateMany({
    where: {
      userId: String(userId),
      read: false,
    },
    data: {
      read: true,
    },
  });

  return listNotificationsByUser(userId, {}, tx);
}

export async function deleteNotification(userId, notificationId, tx = prisma) {
  const notification = await tx.notification.findFirst({
    where: {
      id: String(notificationId),
      userId: String(userId),
    },
  });

  if (!notification) {
    return null;
  }

  return tx.notification.delete({
    where: {
      id: notification.id,
    },
  });
}
