import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../components/Button.jsx";
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

  const requestedGoalId = searchParams.get("goal") || "";

  const loadSavePage = useCallback(async () => {
    try {
      const [goalsData, activityData] = await Promise.all([getGoals(), getSavingsActivity()]);
      const orderedGoals = requestedGoalId
        ? [...goalsData].sort((left, right) => {
            if (left._id === requestedGoalId) return -1;
            if (right._id === requestedGoalId) return 1;
            return 0;
          })
        : goalsData;

      setGoals(orderedGoals);
      setActivity(sortActivityByNewest(activityData));
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || err.message || "We could not load the save flow.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate, requestedGoalId]);

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
    <Layout >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="ui-card loading-panel">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading save flow...</span>
        </section>
      ) : goals.length ? (
        <SaveFlow goals={goals} activity={activity} onSubmit={handleSubmit} isSubmitting={isSubmitting} initialGoalId={requestedGoalId} />
      ) : (
        <section className="ui-card empty-state-card">
          <div className="empty-state">No goals found. Create a goal before saving.</div>
          <Button onClick={() => navigate("/goals/new")}>Create a goal</Button>
        </section>
      )}
    </Layout>
  );
}


