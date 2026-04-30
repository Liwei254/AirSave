export default function EmptyState({ title = "Nothing here yet.", message = "", action = null }) {
  return (
    <div className="empty-state app-empty-state">
      <strong>{title}</strong>
      {message ? <span>{message}</span> : null}
      {action}
    </div>
  );
}
