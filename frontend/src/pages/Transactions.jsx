import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActivityList from "../components/ActivityList.jsx";
import FilterTabs from "../components/FilterTabs.jsx";
import Card from "../components/Card.jsx";
import Layout from "../components/Layout.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import { getSavingsActivity } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { activityFilters, getFilterLabel, getSavingsSummary, isWithinActivityFilter, sortActivityByNewest } from "../utils/savings";

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

  const filteredActivity = useMemo(() => activity.filter((item) => isWithinActivityFilter(item, filter)), [activity, filter]);
  const weeklySavings = useMemo(() => getSavingsSummary(activity.filter((item) => isWithinActivityFilter(item, "week"))), [activity]);
  const selectedSummary = getSavingsSummary(filteredActivity);

  return (
    <Layout >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="overflow-grid-shell">
        <section className="fixed-stats-grid">
          <StatCard label="This week" value={formatCurrency(weeklySavings)} hint="You saved this much in the last 7 days" tone="success" />
          <StatCard label="Current view" value={formatCurrency(selectedSummary)} hint={`Confirmed savings ${getFilterLabel(filter)}`} tone="cool" />
          <StatCard label="Entries" value={String(filteredActivity.length)} hint="Filtered savings records" />
        </section>
      </div>

      <Card className="activity-history-card" hover={false}>
        <SectionHeader
          title="Transaction history"
          subtitle="Review your savings activity."
          actions={<FilterTabs items={activityFilters} value={filter} onChange={setFilter} className="activity-history-filters" />}
          className="activity-history-header"
        />
        {isLoading ? (
          <div className="loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading activity...</span>
          </div>
        ) : (
          <ActivityList items={filteredActivity} emptyMessage="No savings records for this range yet." compact />
        )}
      </Card>
    </Layout>
  );
}


