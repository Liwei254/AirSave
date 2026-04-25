import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import ActivityList from "../components/ActivityList.jsx";
import StatCard from "../components/StatCard.jsx";
import { getSavingsActivity } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import {
  activityFilters,
  getFilterLabel,
  getSavingsSummary,
  isWithinActivityFilter,
  sortActivityByNewest,
} from "../utils/savings";

export default function Transactions() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [filter, setFilter] = useState("week");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivityPage = useCallback(async () => {
    try {
      const activityData = await getSavingsActivity();
      setActivity(sortActivityByNewest(activityData));
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      setError(err.response?.data?.message || err.message || "We could not load activity.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadActivityPage();
  }, [loadActivityPage]);

  const filteredActivity = useMemo(
    () => activity.filter((item) => isWithinActivityFilter(item, filter)),
    [activity, filter]
  );
  const weeklySavings = useMemo(
    () => getSavingsSummary(activity.filter((item) => isWithinActivityFilter(item, "week"))),
    [activity]
  );
  const selectedSummary = getSavingsSummary(filteredActivity);

  return (
    <Layout
      eyebrow="Activity"
      title="Savings activity"
      subtitle="Filter your savings history, review patterns, and keep track of every confirmed contribution."
      shellClassName="savings-shell"
    >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="app-grid-3">
        <StatCard label="This week" value={formatCurrency(weeklySavings)} hint="You saved this much in the last 7 days" tone="success" />
        <StatCard label="Current view" value={formatCurrency(selectedSummary)} hint={`Confirmed savings ${getFilterLabel(filter)}`} tone="cool" />
        <StatCard label="Entries" value={String(filteredActivity.length)} hint="Filtered savings records" />
      </section>

      <section className="app-card savings-card">
        <div className="card-header savings-card-header">
          <div>
            <h2 className="card-title">Full transaction history</h2>
            <p className="card-subtitle">You saved {formatCurrency(weeklySavings)} this week.</p>
          </div>
          <div className="activity-filter-row">
            {activityFilters.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`activity-filter ${filter === option.value ? "activity-filter-active" : ""}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="activity-summary-banner">
          You saved {formatCurrency(selectedSummary)} {getFilterLabel(filter)}.
        </div>

        {isLoading ? (
          <div className="loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading activity...</span>
          </div>
        ) : (
          <ActivityList items={filteredActivity} emptyMessage="No savings records for this range yet." />
        )}
      </section>
    </Layout>
  );
}

