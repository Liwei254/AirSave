import { formatCurrency } from "../utils/formatters";

export default function GoalCard({ goal }) {
  const savedAmount = Number(goal.savedAmount || 0);
  const targetAmount = Number(goal.targetAmount || 0);
  const progress = targetAmount ? Math.min((savedAmount / targetAmount) * 100, 100) : 0;
  const remaining = Math.max(0, targetAmount - savedAmount);
  const statusClass = goal.status === "completed" ? "badge badge-success" : "badge badge-neutral";

  return (
    <div className="goal-item">
      <div className="goal-row">
        <div>
          <div className="goal-name">{goal.name}</div>
          <div className="goal-meta">
            <span>{formatCurrency(savedAmount)} saved</span>
            <span>Target {formatCurrency(targetAmount)}</span>
            {goal.duration ? <span>Duration {goal.duration}</span> : null}
          </div>
        </div>
        <span className={statusClass}>{goal.status || "active"}</span>
      </div>

      <div className="progress" role="progressbar" aria-label={`${goal.name} progress`} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
        <div
          className={`progress-bar ${goal.status === "completed" ? "bg-success" : ""}`}
          style={{ width: `${progress}%` }}
        >
          {Math.round(progress)}%
        </div>
      </div>

      <div className="goal-row">
        <span className="muted">{Math.round(progress)}% complete</span>
        <span className="muted">Remaining {formatCurrency(remaining)}</span>
      </div>
    </div>
  );
}
