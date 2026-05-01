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
  const isComplete = goal.status === "completed";

  return (
    <Card className={["goal-card", "goal-progress-card", selected ? "goal-card-selected" : "", isComplete ? "goal-card-complete" : ""].filter(Boolean).join(" ")}>
      <div className="goal-card-top">
        <div className="goal-card-heading">
          <span className="goal-card-label">Savings goal</span>
          <h3 className="goal-card-title">{goal.name}</h3>
          <p className="goal-card-subtitle">
            {getGoalMotivation(goal, formatCurrency)}
          </p>
        </div>
        <span className={`badge ${isComplete ? "badge-success" : "badge-neutral"}`}>
          {goal.status || "active"}
        </span>
      </div>

      <div className="goal-card-amounts" aria-label={`${goal.name} savings progress`}>
        <div>
          <span>Saved</span>
          <strong>{formatCurrency(goal.savedAmount)}</strong>
        </div>
        <div>
          <span>Target</span>
          <strong>{formatCurrency(goal.targetAmount)}</strong>
        </div>
      </div>

      <div className="goal-progress-hero">
        <ProgressBar value={progress} complete={isComplete} className="goal-progress-track" />
      </div>

      <div className="goal-progress-labels">
        <span>{progress}% complete</span>
        <span>{formatCurrency(remaining)} remaining</span>
      </div>

      <p className="goal-card-copy goal-card-copy-muted">{getEstimatedCompletion(goal, weeklySavingsRate)}</p>

      <div className="goal-card-actions">
        {onSelect ? (
          <Button type="button" variant={selected ? "primary" : "secondary"} onClick={() => onSelect(goal._id)}>
            {selected ? "Selected goal" : "Select goal"}
          </Button>
        ) : null}
        {showQuickSave ? (
          <Button type="button" variant="primary" onClick={() => navigate("/payments")}>
            Add savings
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
