import { Link } from "react-router-dom";
import { formatDate } from "../utils/formatters";

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function toneIcon(type) {
  if (type === "goal") return "🎯";
  if (type === "saving") return "💸";
  return "🔔";
}

function NotificationGroup({ title, items }) {
  if (!items.length) return null;

  return (
    <div className="notification-dropdown-group">
      <div className="notification-dropdown-group-title">{title}</div>
      <div className="notification-dropdown-list">
        {items.map((notification) => (
          <div className="notification-dropdown-item" key={notification._id}>
            <span className="notification-dropdown-icon" aria-hidden="true">
              {toneIcon(notification.type)}
            </span>
            <div className="notification-dropdown-copy">
              <div className="notification-dropdown-message">{notification.message}</div>
              <div className="notification-dropdown-meta">{formatDate(notification.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationDropdown({ notifications, open, onClose }) {
  if (!open) return null;

  const latestFive = notifications.slice(0, 5);
  const todayItems = latestFive.filter((item) => isToday(item.createdAt));
  const earlierItems = latestFive.filter((item) => !isToday(item.createdAt));

  return (
    <div className="navbar-popover notification-dropdown">
      <div className="notification-dropdown-header">
        <div>
          <strong>Notifications</strong>
          <div className="muted">Latest account updates</div>
        </div>
        <button className="icon-button subtle-button" type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      {latestFive.length ? (
        <>
          <NotificationGroup title="Today" items={todayItems} />
          <NotificationGroup title="Earlier" items={earlierItems} />
        </>
      ) : (
        <div className="empty-state compact-empty-state">No notifications yet.</div>
      )}

      <Link className="notification-dropdown-link" to="/support" onClick={onClose}>
        View All
      </Link>
    </div>
  );
}
