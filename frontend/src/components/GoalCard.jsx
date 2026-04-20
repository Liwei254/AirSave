import { formatCurrency, getGoalProgress } from "../utils/formatters";

export default function GoalCard({ goal }) {
  const progress = getGoalProgress(goal);
  const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.savedAmount));
  const statusClass = goal.status === "completed" ? "badge badge-success" : "badge badge-neutral";

  return (
    <div className="goal-item" key={goal._id}>
      <div className="goal-row">
        <div>
          <div className="goal-name">{goal.name}</div>
          <div className="goal-meta">
            <span>{formatCurrency(goal.savedAmount)} saved</span>
            <span>Target {formatCurrency(goal.targetAmount)}</span>
            {goal.duration ? <span>Duration {goal.duration}</span> : null}
          </div>
        </div>
        <span className={statusClass}>{goal.status || "active"}</span>
      </div>

      <progress className="progress-track" value={progress} max="100">
        {progress}%
      </progress>

      <div className="goal-row">
        <span className="muted">{progress}% complete</span>
        <span className="muted">Remaining {formatCurrency(remaining)}</span>
      </div>
    </div>
  );
}
