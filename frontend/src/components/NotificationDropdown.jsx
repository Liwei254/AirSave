import { Link } from "react-router-dom";
import { formatDate } from "../utils/formatters";

function getNotificationTone(type) {
  if (type === "saving") return "saving";
  if (type === "success" || type === "goal") return "success";
  return "system";
}

function NotificationTypeIcon({ type }) {
  const tone = getNotificationTone(type);

  if (tone === "success") {
    return (
      <svg viewBox="0 0 24 24" className="notification-dropdown-symbol" aria-hidden="true">
        <path d="M6.5 12.5 10 16l7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tone === "saving") {
    return (
      <svg viewBox="0 0 24 24" className="notification-dropdown-symbol" aria-hidden="true">
        <path d="M12 3v18M16.5 7.5C15.7 6.6 14.2 6 12.5 6c-2.5 0-4.5 1.4-4.5 3.3s1.8 2.8 4.2 3.2c2.6.5 4.8 1.2 4.8 3.5 0 2-2 3.5-4.8 3.5-1.9 0-3.6-.6-4.8-1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="notification-dropdown-symbol" aria-hidden="true">
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4v-3.2a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 17a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NotificationItem({ notification, onMarkAsRead }) {
  const isUnread = !notification.read;
  const tone = getNotificationTone(notification.type);
  const title = tone === "saving" ? "Saving" : tone === "success" ? "Success" : "System";

  return (
    <div className={["notification-dropdown-item", `notification-dropdown-item-${tone}`, isUnread ? "notification-dropdown-item-unread" : ""].filter(Boolean).join(" ")}>
      <span className={["notification-dropdown-icon", `notification-dropdown-icon-${tone}`].join(" ")} aria-hidden="true">
        <NotificationTypeIcon type={notification.type} />
      </span>
      <div className="notification-dropdown-copy">
        <div className="notification-dropdown-row">
          <div className="notification-dropdown-title">{title}</div>
          <div className="notification-dropdown-time">{formatDate(notification.createdAt)}</div>
        </div>
        <div className="notification-dropdown-message">{notification.message}</div>
        {isUnread ? (
          <button className="notification-dropdown-inline-action" type="button" onClick={() => onMarkAsRead(notification._id)}>
            Mark read
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function NotificationDropdown({
  notifications,
  open,
  onClose,
  onMarkAllRead,
  onMarkAsRead,
}) {
  if (!open) return null;

  const latestFive = notifications.slice(0, 5);
  const unreadCount = latestFive.filter((item) => !item.read).length;

  return (
    <div className="navbar-popover notification-dropdown">
      <div className="notification-dropdown-header">
        <div className="notification-dropdown-header-copy">
          <strong>Notifications</strong>
          <div className="muted">{unreadCount ? `${unreadCount} unread updates` : "You're all caught up"}</div>
        </div>
        <button className="notification-dropdown-header-action" type="button" onClick={onMarkAllRead} disabled={!unreadCount}>
          Mark all read
        </button>
      </div>

      {latestFive.length ? (
        <div className="notification-dropdown-scroll">
          {latestFive.map((notification) => (
            <NotificationItem key={notification._id} notification={notification} onMarkAsRead={onMarkAsRead} />
          ))}
        </div>
      ) : (
        <div className="notification-dropdown-empty">No new notifications</div>
      )}

      <div className="notification-dropdown-footer">
        <Link className="notification-dropdown-link" to="/activity" onClick={onClose}>
          View all updates
        </Link>
      </div>
    </div>
  );
}
