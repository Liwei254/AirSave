import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import StatCard from "../components/StatCard.jsx";
import ActivityList from "../components/ActivityList.jsx";
import { getGoals, getSavingsActivity, getWallet } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { getSavingsSummary, isWithinActivityFilter, sortActivityByNewest } from "../utils/savings";

export default function Dashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const [walletData, goalsData, activityData] = await Promise.all([
        getWallet(),
        getGoals(),
        getSavingsActivity(),
      ]);

      setWallet(walletData);
      setGoals(goalsData);
      setActivity(sortActivityByNewest(activityData).slice(0, 35));
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      setError(err.response?.data?.message || err.message || "We could not load your dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const weeklySavings = useMemo(
    () => getSavingsSummary(activity.filter((item) => isWithinActivityFilter(item, "week"))),
    [activity]
  );
  const activeGoalsCount = goals.filter((goal) => goal.status !== "completed").length;

  return (
    <Layout
      eyebrow="Dashboard"
      title="Your savings overview"
      subtitle="See progress at a glance, then jump into a focused save flow when you are ready."
      actions={
        <button className="app-button app-button-primary savings-hero-button" type="button" onClick={() => navigate("/save") }>
          Save Now
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

      <section className="app-grid-3">
        <StatCard label="Total savings" value={formatCurrency(wallet?.balance)} hint="Across all active savings activity" tone="cool" />
        <StatCard label="This week" value={formatCurrency(weeklySavings)} hint="Confirmed savings in the last 7 days" tone="success" />
        <StatCard label="Active goals" value={String(activeGoalsCount)} hint="Goals currently in progress" />
      </section>

      <section className="app-card savings-card">
        <div className="card-header savings-card-header">
          <div>
            <h2 className="card-title">Recent activity</h2>
            <p className="card-subtitle">Your latest 35 savings records.</p>
          </div>
          <button className="app-button app-button-secondary" type="button" onClick={() => navigate("/activity")}>
            View all activity
          </button>
        </div>

        {isLoading ? (
          <div className="loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading dashboard...</span>
          </div>
        ) : (
          <ActivityList
            items={activity}
            compact
            emptyMessage="No savings activity yet. Start with your first save."
          />
        )}
      </section>
    </Layout>
  );
}

