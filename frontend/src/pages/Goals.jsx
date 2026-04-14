import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import GoalCard from "../components/GoalCard.jsx";
import { createGoal, getGoals } from "../services/api";

export default function Goals() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    loadGoals(isMounted);
    return () => {
      isMounted = false;
    };
  }, []);

  async function loadGoals(isMounted = true) {
    try {
      const data = await getGoals();
      if (!isMounted) return;
      setGoals(data);
      setError("");
    } catch (err) {
      if (!isMounted) return;
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || "We could not load your goals.");
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }

  async function handleCreateGoal() {
    if (!goalName || !targetAmount) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const goal = await createGoal({
        name: goalName,
        targetAmount: Number(targetAmount),
      });

      setGoals((current) => [goal, ...current]);
      setGoalName("");
      setTargetAmount("");
      setFeedback({ type: "success", message: "Goal created successfully." });
    } catch (err) {
      setFeedback({ type: "error", message: err.response?.data?.message || "Failed to create goal." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const createDisabled = !goalName.trim() || !targetAmount || Number(targetAmount) <= 0 || isSubmitting;
  const activeGoals = goals.filter((goal) => goal.status !== "completed");
  const completedGoals = goals.filter((goal) => goal.status === "completed");

  return (
    <Layout
      eyebrow="Goals"
      title="Manage your savings targets."
      subtitle="Create new goals, track progress, and keep every round-up aligned to a purpose."
    >
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="dashboard-columns">
        <article className="app-card goals-column">
          <div className="card-header">
            <div>
              <h2 className="card-title">Create a goal</h2>
              <p className="card-subtitle">Set a target</p>
            </div>
          </div>

          <div className="goal-create-card">
            <div className="goal-create-fields">
              <div className="field-group">
                <label className="field-label" htmlFor="goalName">
                  Goal name
                </label>
                <input
                  id="goalName"
                  className="app-input"
                  type="text"
                  placeholder="Emergency fund"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="targetAmount">
                  Target amount
                </label>
                <input
                  id="targetAmount"
                  className="app-input"
                  type="number"
                  min="1"
                  placeholder="50000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="form-actions goal-create-actions">
              <button
                className="app-button app-button-primary glow-button"
                type="button"
                onClick={handleCreateGoal}
                disabled={createDisabled}
              >
                {isSubmitting ? <span className="spinner" aria-hidden="true" /> : null}
                <span>{isSubmitting ? "Creating..." : "Create goal"}</span>
              </button>
            </div>
          </div>
        </article>

        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Goals overview</h2>
              <p className="card-subtitle">Active goals first, with completed ones tucked away until you need them.</p>
            </div>
            <div className="status-chip">{goals.length} total</div>
          </div>

          {isLoading ? (
            <div className="loading-panel">
              <span className="spinner spinner-dark" aria-hidden="true" />
              <span>Loading goals...</span>
            </div>
          ) : goals.length ? (
            <div className="goal-page-stack">
              <div className="goal-section-header">
                <div>
                  <strong>Active goals</strong>
                  <div className="muted">{activeGoals.length} currently in progress</div>
                </div>
              </div>

              {activeGoals.length ? (
                <div className="goal-list">
                  {activeGoals.map((goal) => (
                    <GoalCard key={goal._id} goal={goal} />
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty-state">No active goals right now.</div>
              )}

              <div className="goal-section-header">
                <div>
                  <strong>Completed goals</strong>
                  <div className="muted">{completedGoals.length} archived achievements</div>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setShowCompleted((current) => !current)}
                >
                  {showCompleted ? "Hide" : "Show"}
                </button>
              </div>

              {showCompleted ? (
                completedGoals.length ? (
                  <div className="goal-list">
                    {completedGoals.map((goal) => (
                      <GoalCard key={goal._id} goal={goal} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact-empty-state">No completed goals yet.</div>
                )
              ) : null}
            </div>
          ) : (
            <div className="empty-state">No goals yet. Create one to start tracking your savings progress.</div>
          )}
        </article>
      </section>
    </Layout>
  );
}
