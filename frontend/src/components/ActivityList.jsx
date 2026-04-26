import { formatCurrency, formatDate } from "../utils/formatters";

function getStatusTone(status) {
  if (status === "confirmed") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

function ActivityRow({ item, compact = false }) {
  return (
    <article className={["activity-feed-row", compact ? "activity-feed-row-compact" : ""].filter(Boolean).join(" ")}>
      <div className="activity-feed-copy">
        <div className="activity-primary">{item.goalName || "Savings"}</div>
        <div className="activity-secondary">{formatDate(item.date)}</div>
        <div className="activity-tertiary">M-Pesa transfer</div>
      </div>

      <div className="activity-feed-meta">
        <strong className="activity-savings-cell">{formatCurrency(item.savings)}</strong>
        <span className={["badge", "activity-status-badge", `activity-status-badge-${getStatusTone(item.status)}`].join(" ")}>
          {item.status}
        </span>
      </div>
    </article>
  );
}

export default function ActivityList({ items, emptyMessage = "No activity yet.", compact = false }) {
  if (!items.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className={["activity-feed", compact ? "activity-feed-compact" : "activity-feed-expanded"].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <ActivityRow key={item._id} item={item} compact={compact} />
      ))}
    </div>
  );
}
