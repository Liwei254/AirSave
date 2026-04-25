import { useNavigate } from "react-router-dom";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import ProgressBar from "./ProgressBar.jsx";
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
    <Card className={["goal-card", selected ? "goal-card-selected" : ""].filter(Boolean).join(" ")}>
      <div className="goal-card-top">
        <div>
          <h3 className="goal-card-title">{goal.name}</h3>
          <p className="goal-card-subtitle">
            Saved {formatCurrency(goal.savedAmount)} of {formatCurrency(goal.targetAmount)}
          </p>
        </div>
        <span className={`badge ${goal.status === "completed" ? "badge-success" : "badge-neutral"}`}>
          {goal.status || "active"}
        </span>
      </div>

      <ProgressBar value={progress} complete={goal.status === "completed"} className="goal-progress-track" />

      <div className="goal-progress-labels">
        <span>{progress}% complete</span>
        <span>{formatCurrency(remaining)} remaining</span>
      </div>

      <p className="goal-card-copy">{getGoalMotivation(goal, formatCurrency)}</p>
      <p className="goal-card-copy goal-card-copy-muted">{getEstimatedCompletion(goal, weeklySavingsRate)}</p>

      <div className="goal-card-actions">
        {onSelect ? (
          <Button type="button" variant={selected ? "primary" : "secondary"} onClick={() => onSelect(goal._id)}>
            {selected ? "Selected goal" : "Select goal"}
          </Button>
        ) : null}
        {showQuickSave ? (
          <Button type="button" variant="primary" onClick={() => navigate(`/save?goal=${goal._id}`)}>
            Quick save
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
