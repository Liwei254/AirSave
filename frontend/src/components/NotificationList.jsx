import { formatDate } from "../utils/formatters";

function getNotificationTone(type) {
  if (type === "goal") return "badge badge-success";
  if (type === "saving") return "badge badge-warning";
  return "badge badge-neutral";
}

export default function NotificationList({
  notifications,
  onMarkAsRead,
  emptyMessage = "No notifications yet.",
}) {
  if (!notifications.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="notification-list">
      {notifications.map((notification) => (
        <div className="notification-item" key={notification._id}>
          <div className="notification-row">
            <div>
              <div className="notification-title">{notification.message}</div>
              <div className="notification-meta">
                <span>{formatDate(notification.createdAt)}</span>
                <span className={getNotificationTone(notification.type)}>{notification.type || "update"}</span>
              </div>
            </div>

            {!notification.read && onMarkAsRead ? (
              <button
                className="text-button"
                type="button"
                onClick={() => onMarkAsRead(notification._id)}
              >
                Mark as read
              </button>
            ) : (
              <span className="badge badge-neutral">{notification.read ? "Read" : "New"}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
