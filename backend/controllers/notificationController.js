import {
  deleteNotification as deleteNotificationService,
  getNotifications as getNotificationsService,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getNotifications(req, res, next) {
  try {
    const notifications = await getNotificationsService(req.user._id, req.query || {});

    return sendSuccess(res, {
      message: "Notifications fetched successfully",
      data: notifications,
    });
  } catch (error) {
    return next(error);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const notifications = await markAllNotificationsRead(req.user._id);

    return sendSuccess(res, {
      message: "Notifications marked as read",
      data: notifications,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const notification = await deleteNotificationService(req.user._id, req.params.id);

    return sendSuccess(res, {
      message: "Notification deleted",
      data: { notification },
    });
  } catch (error) {
    return next(error);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const notification = await markNotificationRead(req.user._id, req.params.id);

    return sendSuccess(res, {
      message: "Notification marked as read",
      data: { notification },
    });
  } catch (error) {
    return next(error);
  }
}
