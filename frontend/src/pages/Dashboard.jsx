import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActivityList from "../components/ActivityList.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import Layout from "../components/Layout.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import StatCard from "../components/StatCard.jsx";
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
      const [walletData, goalsData, activityData] = await Promise.all([getWallet(), getGoals(), getSavingsActivity()]);
      setWallet(walletData);
      setGoals(goalsData);
      setActivity(sortActivityByNewest(activityData).slice(0, 35));
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
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

  const weeklySavings = useMemo(() => getSavingsSummary(activity.filter((item) => isWithinActivityFilter(item, "week"))), [activity]);
  const activeGoalsCount = goals.filter((goal) => goal.status !== "completed").length;

  return (
    <Layout
      eyebrow="Dashboard"
      title="Your savings overview"
      subtitle="See progress at a glance, track recent activity, and jump into a focused save flow when you are ready."
      actions={<Button onClick={() => navigate("/save")}>Save Now</Button>}
    >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="overflow-grid-shell">
        <section className="fixed-stats-grid">
          <StatCard label="Total savings" value={formatCurrency(wallet?.balance)} hint="Across wallet and active goal contributions" tone="cool" />
          <StatCard label="Weekly savings" value={formatCurrency(weeklySavings)} hint="Confirmed savings in the current week" tone="success" />
          <StatCard label="Active goals" value={String(activeGoalsCount)} hint="Goals currently in progress" />
        </section>
      </div>

      <Card>
        <SectionHeader
          title="Recent activity"
          subtitle="Your latest 35 savings records, refreshed in one place."
          actions={<Button variant="secondary" onClick={() => navigate("/activity")}>View all</Button>}
        />

        {isLoading ? (
          <div className="loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading dashboard...</span>
          </div>
        ) : (
          <ActivityList items={activity} compact emptyMessage="No savings activity yet. Start with your first save." />
        )}
      </Card>
    </Layout>
  );
}


