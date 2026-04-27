import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import GoalList from "../components/GoalList.jsx";
import Layout from "../components/Layout.jsx";
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
      actions={<Button onClick={() => navigate("/goals/new")}>New goal</Button>}
    >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="ui-card loading-panel">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading goals...</span>
        </section>
      ) : (
        <div className="overflow-grid-shell">
          <GoalList goals={goals} weeklySavingsRate={weeklySavingsRate} showQuickSave />
        </div>
      )}
    </Layout>
  );
}


