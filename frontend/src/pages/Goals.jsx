import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Layout from "../components/Layout.jsx";
import { deleteGoal, getActiveGoal, updateGoal } from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { formatCurrency, formatDate, getGoalProgress } from "../utils/formatters";

const amountFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

function parseNumericInput(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  return digitsOnly ? String(Number(digitsOnly)) : "";
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getGoalAmount(goal) {
  return Number(goal?.currentAmount ?? goal?.savedAmount ?? 0);
}

function MyGoalCard({ goal, onChanged }) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({
    name: goal?.name || "",
    targetAmount: String(goal?.targetAmount || ""),
    deadline: toDateInputValue(goal?.deadline || goal?.expectedCompletionDate),
  });

  useEffect(() => {
    setForm({
      name: goal?.name || "",
      targetAmount: String(goal?.targetAmount || ""),
      deadline: toDateInputValue(goal?.deadline || goal?.expectedCompletionDate),
    });
  }, [goal]);

  const currentAmount = getGoalAmount(goal);
  const targetAmount = Number(goal?.targetAmount || 0);
  const progress = getGoalProgress(goal);
  const remaining = Math.max(0, targetAmount - currentAmount);
  const canSave = form.name.trim() && Number(form.targetAmount) > 0 && form.deadline && !isSaving;

  async function saveGoal(event) {
    event?.preventDefault();

    if (!canSave) {
      setFeedback({ type: "error", message: "Add a name, target amount, and deadline." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      await updateGoal(goal._id, {
        name: form.name.trim(),
        targetAmount: Number(form.targetAmount),
        deadline: form.deadline,
        expectedCompletionDate: form.deadline,
        status: "active",
      });
      setIsEditing(false);
      setFeedback({ type: "success", message: "Goal updated." });
      triggerDashboardRefresh();
      await onChanged();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not update your goal.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function completeGoal() {
    setIsSaving(true);
    setFeedback(null);

    try {
      await updateGoal(goal._id, { status: "completed" });
      setFeedback({ type: "success", message: "Goal completed." });
      triggerDashboardRefresh();
      await onChanged();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete your goal.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function closeGoal() {
    setIsSaving(true);
    setFeedback(null);

    try {
      await deleteGoal(goal._id);
      setFeedback({ type: "success", message: "Goal closed." });
      triggerDashboardRefresh();
      await onChanged();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not close your goal.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="my-goal-card" aria-labelledby="myGoalTitle">
      {feedback ? (
        <div className={`my-goal-feedback my-goal-feedback-${feedback.type}`} role="status">
          {feedback.message}
        </div>
      ) : null}

      <div className="my-goal-top">
        <div>
          <span className="premium-kicker">My Goal</span>
          <h1 id="myGoalTitle">{goal.name}</h1>
          <p>You already have an active goal. Complete or close it before creating another.</p>
        </div>
        <span className="my-goal-status">Active</span>
      </div>

      <div className="my-goal-progress-panel">
        <div className="my-goal-progress-head">
          <span>Current progress</span>
          <strong>{progress}%</strong>
        </div>
        <div className="my-goal-progress-track" aria-label={`${progress}% funded`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="my-goal-stats">
        <article>
          <span>Current amount</span>
          <strong>{formatCurrency(currentAmount)}</strong>
        </article>
        <article>
          <span>Target amount</span>
          <strong>{formatCurrency(targetAmount)}</strong>
        </article>
        <article>
          <span>Remaining</span>
          <strong>{formatCurrency(remaining)}</strong>
        </article>
        <article>
          <span>Deadline</span>
          <strong>{goal.deadline || goal.expectedCompletionDate ? formatDate(goal.deadline || goal.expectedCompletionDate) : "No deadline"}</strong>
        </article>
      </div>

      {isEditing ? (
        <form className="my-goal-edit-form" onSubmit={saveGoal}>
          <label>
            <span>Goal name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Goal name"
            />
          </label>
          <label>
            <span>Target amount</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.targetAmount ? amountFormatter.format(Number(form.targetAmount || 0)) : ""}
              onChange={(event) => setForm((current) => ({ ...current, targetAmount: parseNumericInput(event.target.value) }))}
              placeholder="50,000"
            />
          </label>
          <label>
            <span>Deadline</span>
            <input
              type="date"
              value={form.deadline}
              onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))}
            />
          </label>
          <div className="my-goal-edit-actions">
            <button type="submit" disabled={!canSave}>
              {isSaving ? "Saving..." : "Save changes"}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} disabled={isSaving}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="my-goal-actions">
        <button type="button" onClick={() => navigate("/lipa-na-airsave")}>
          Add savings
        </button>
        <button type="button" onClick={() => setIsEditing((current) => !current)}>
          Edit goal
        </button>
        <button type="button" onClick={completeGoal} disabled={isSaving}>
          Complete goal
        </button>
        <button type="button" onClick={closeGoal} disabled={isSaving}>
          Close goal
        </button>
      </div>
    </section>
  );
}

export default function Goals() {
  const navigate = useNavigate();
  const [activeGoal, setActiveGoal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGoalPage = useCallback(async () => {
    setIsLoading(true);

    try {
      const goal = await getActiveGoal();
      setActiveGoal(goal);
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || err.message || "We could not load your goal.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadGoalPage();
  }, [loadGoalPage]);

  const actions = useMemo(() => {
    if (activeGoal) return null;
    return <Button onClick={() => navigate("/goals/new")}>Create goal</Button>;
  }, [activeGoal, navigate]);

  return (
    <Layout actions={actions}>
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="ui-card loading-panel">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading goal...</span>
        </section>
      ) : activeGoal ? (
        <MyGoalCard goal={activeGoal} onChanged={loadGoalPage} />
      ) : (
        <section className="my-goal-empty">
          <span className="premium-kicker">My Goal</span>
          <h1>No active goal yet.</h1>
          <p>Create one savings goal and AirSave will send eligible round-ups there automatically.</p>
          <button type="button" onClick={() => navigate("/goals/new")}>
            Create your savings goal
          </button>
        </section>
      )}
    </Layout>
  );
}
