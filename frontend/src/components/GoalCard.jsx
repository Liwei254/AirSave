import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../utils/formatters";
import {
  getEstimatedCompletion,
  getGoalMotivation,
  getGoalProgress,
  getGoalRemaining,
} from "../utils/savings";

export default function GoalCard({ goal, weeklySavingsRate = 0, selected = false, onSelect, showQuickSave = false }) {
  const navigate = useNavigate();
  const progress = getGoalProgress(goal);
  const remaining = getGoalRemaining(goal);

  return (
    <article className={`goal-progress-card ${selected ? "goal-progress-card-selected" : ""}`}>
      <div className="goal-progress-top">
        <div>
          <div className="goal-progress-name">{goal.name}</div>
          <div className="goal-progress-meta">
            Saved {formatCurrency(goal.savedAmount)} of {formatCurrency(goal.targetAmount)}
          </div>
        </div>
        <span className={`badge ${goal.status === "completed" ? "badge-success" : "badge-neutral"}`}>
          {goal.status || "active"}
        </span>
      </div>

      <div className="savings-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
        <div
          className={`savings-progress-fill ${goal.status === "completed" ? "savings-progress-fill-complete" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="goal-progress-stats">
        <span>{progress}% complete</span>
        <span>{formatCurrency(remaining)} remaining</span>
      </div>

      <p className="goal-progress-motivation">{getGoalMotivation(goal, formatCurrency)}</p>
      <p className="goal-progress-estimate">{getEstimatedCompletion(goal, weeklySavingsRate)}</p>

      <div className="goal-card-actions">
        {onSelect ? (
          <button className="app-button app-button-secondary" type="button" onClick={() => onSelect(goal._id)}>
            {selected ? "Selected" : "Select goal"}
          </button>
        ) : null}
        {showQuickSave ? (
          <button
            className="app-button app-button-primary"
            type="button"
            onClick={() => navigate(`/save?goal=${goal._id}`)}
          >
            Quick save
          </button>
        ) : null}
      </div>
    </article>
  );
}

