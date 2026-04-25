import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import GoalList from "../components/GoalList.jsx";
import { getGoals, getSavingsActivity } from "../services/api";
import { getWeeklySavingsRate, sortActivityByNewest } from "../utils/savings";

export default function Goals() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGoalsPage = useCallback(async () => {
    try {
      const [goalsData, activityData] = await Promise.all([getGoals(), getSavingsActivity()]);
      setGoals(goalsData);
      setActivity(sortActivityByNewest(activityData));
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      setError(err.response?.data?.message || err.message || "We could not load your goals.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadGoalsPage();
  }, [loadGoalsPage]);

  const weeklySavingsRate = getWeeklySavingsRate(activity);

  return (
    <Layout
      eyebrow="Goals"
      title="Your savings goals"
      subtitle="Track every target, see what remains, and jump into a quick save when you need to."
      actions={
        <button className="app-button app-button-primary" type="button" onClick={() => navigate("/goals/new")}>
          New goal
        </button>
      }
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
          <span>Loading goals...</span>
        </section>
      ) : (
        <GoalList goals={goals} weeklySavingsRate={weeklySavingsRate} showQuickSave />
      )}
    </Layout>
  );
}

