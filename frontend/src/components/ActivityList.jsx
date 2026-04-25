import { formatCurrency, formatDate } from "../utils/formatters";

function getStatusTone(status) {
  if (status === "confirmed") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

export default function ActivityList({ items, emptyMessage = "No activity yet.", compact = false }) {
  if (!items.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  if (compact) {
    return (
      <div className="activity-feed">
        {items.map((item) => (
          <article key={item._id} className="activity-feed-row">
            <div className="activity-feed-copy">
              <div className="activity-primary">{item.goalName || "Savings"}</div>
              <div className="activity-secondary">{formatDate(item.date)}</div>
            </div>
            <div className="activity-feed-meta">
              <strong>{formatCurrency(item.savings)}</strong>
              <span className={`badge badge-${getStatusTone(item.status)}`}>{item.status}</span>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="activity-table-wrap">
      <table className="activity-table">
        <thead>
          <tr>
            <th>Goal</th>
            <th>Charged</th>
            <th>Saved</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id}>
              <td>
                <div className="activity-primary">{item.goalName || "Savings goal"}</div>
                <div className="activity-secondary">M-Pesa transfer</div>
              </td>
              <td>{formatCurrency(item.amount)}</td>
              <td className="activity-savings-cell">{formatCurrency(item.savings)}</td>
              <td>{formatDate(item.date)}</td>
              <td>
                <span className={`badge badge-${getStatusTone(item.status)}`}>{item.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
