import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import SaveFlow from "../components/SaveFlow.jsx";
import { getGoals, getSavingsActivity, initiatePayment } from "../services/api";
import { sortActivityByNewest } from "../utils/savings";

export default function Savings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [goals, setGoals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadSavePage = useCallback(async () => {
    try {
      const [goalsData, activityData] = await Promise.all([getGoals(), getSavingsActivity()]);
      const sortedActivity = sortActivityByNewest(activityData);
      const requestedGoal = searchParams.get("goal");

      setGoals(requestedGoal
        ? [...goalsData].sort((left, right) => {
            if (left._id === requestedGoal) return -1;
            if (right._id === requestedGoal) return 1;
            return 0;
          })
        : goalsData);
      setActivity(sortedActivity);
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      setError(err.response?.data?.message || err.message || "We could not load the save flow.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    loadSavePage();
  }, [loadSavePage]);

  async function handleSubmit(payload) {
    setIsSubmitting(true);
    try {
      await initiatePayment(payload);
      await loadSavePage();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout
      eyebrow="Save"
      title="Save with M-Pesa"
      subtitle="A focused four-step flow designed to help you save quickly with less friction."
      shellClassName="savings-shell"
    >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="app-card loading-panel">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading save flow...</span>
        </section>
      ) : goals.length ? (
        <SaveFlow goals={goals} activity={activity} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      ) : (
        <section className="app-card savings-card">
          <div className="empty-state">No goals found. Create a goal before saving.</div>
          <div className="form-actions">
            <button className="app-button app-button-primary" type="button" onClick={() => navigate("/goals/new")}>
              Create a goal
            </button>
          </div>
        </section>
      )}
    </Layout>
  );
}

