import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActivityList from "../components/ActivityList.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import Layout from "../components/Layout.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { getGoals, getSavingsActivity, getWallet } from "../services/api";
import { formatCurrency, getGoalProgress } from "../utils/formatters";
import { getSavingsSummary, isWithinActivityFilter, sortActivityByNewest } from "../utils/savings";

function ActionIcon({ type }) {
  if (type === "save") {
    return (
      <svg viewBox="0 0 24 24" className="dashboard-action-icon" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="dashboard-action-icon" aria-hidden="true">
      <path d="M12 19V5m0 14 5-5m-5 5-5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="dashboard-insight-icon" aria-hidden="true">
      <path d="M12 3 13.9 8.1 19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ open = false }) {
  return (
    <svg viewBox="0 0 24 24" className="dashboard-privacy-icon" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {!open ? <path d="M4 20 20 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : null}
    </svg>
  );
}

function buildWeeklyTrend(items) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      label: date.toLocaleDateString("en-KE", { weekday: "short" }),
      total: 0,
    };
  });

  const dayMap = new Map(days.map((day) => [day.key, day]));

  items.forEach((item) => {
    const date = new Date(item.date);
    date.setHours(0, 0, 0, 0);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const targetDay = dayMap.get(key);

    if (targetDay) {
      targetDay.total += Number(item.savings || 0);
    }
  });

  return days;
}

function buildSparklinePath(values) {
  if (!values.length) return "";

  const width = 360;
  const height = 160;
  const max = Math.max(...values, 1);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / max) * 112 - 24;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [balanceVisible, setBalanceVisible] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [walletData, goalsData, activityData] = await Promise.all([getWallet(), getGoals(), getSavingsActivity()]);
      setWallet(walletData);
      setGoals(goalsData);
      setActivity(sortActivityByNewest(activityData));
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
  const weeklyTrend = useMemo(() => buildWeeklyTrend(activity), [activity]);
  const trendPath = useMemo(() => buildSparklinePath(weeklyTrend.map((item) => item.total)), [weeklyTrend]);
  const chartMax = Math.max(...weeklyTrend.map((item) => item.total), 1);
  const primaryGoal = goals[0] || null;
  const activeGoalsCount = goals.filter((goal) => goal.status !== "completed").length;
  const recentTransactions = activity.slice(0, 5);
  const balanceDisplay = balanceVisible ? formatCurrency(wallet?.balance) : "Ksh ******";
  const insightGoalProgress = primaryGoal ? getGoalProgress(primaryGoal) : 0;
  const suggestedNextSave = primaryGoal
    ? Math.max(100, Math.ceil((Number(primaryGoal.targetAmount || 0) - Number(primaryGoal.savedAmount || 0)) / 10 / 50) * 50)
    : 100;
  const insightTitle = weeklySavings > 0 ? "You're building great momentum." : "Your next save can start the momentum.";
  const insightWeekly = `+ ${formatCurrency(weeklySavings)} saved this week`;
  const insightGoal = primaryGoal
    ? `${primaryGoal.name} is ${insightGoalProgress}% complete`
    : `${activeGoalsCount ? activeGoalsCount : "No"} active goals in progress`;
  const insightNextStep = `Next step: Add ${formatCurrency(suggestedNextSave)} to stay on track`;
  const insightPrimaryAction = primaryGoal ? `Save toward ${primaryGoal.name}` : "Create a goal";
  const insightSecondaryAction = primaryGoal ? "View goal" : "View goals";

  return (
    <Layout
      eyebrow="Dashboard"
      title="Your savings overview"
      subtitle="A simple view of your balance, weekly momentum, and most recent activity."
    >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="dashboard-minimal-grid">
        <Card className="dashboard-balance-card dashboard-primary-card dashboard-balance-hero" hover>
          <div className="dashboard-balance-top">
            <div className="dashboard-balance-copy">
              <span className="dashboard-kicker">Available balance</span>
              <div className="dashboard-balance-amount-row">
                <p className={["dashboard-balance-value", balanceVisible ? "" : "dashboard-balance-value-hidden"].filter(Boolean).join(" ")}>
                  {balanceDisplay}
                </p>
                <button
                  type="button"
                  className="dashboard-privacy-button"
                  onClick={() => setBalanceVisible((current) => !current)}
                  aria-label={balanceVisible ? "Hide balance" : "Show balance"}
                >
                  <EyeIcon open={balanceVisible} />
                </button>
              </div>
              <span className="dashboard-balance-meta">Updated from confirmed savings activity.</span>
            </div>
          </div>

          <div className="dashboard-hero-metrics" aria-label="Savings summary">
            <div className="dashboard-hero-metric">
              <span>This week</span>
              <strong>{formatCurrency(weeklySavings)}</strong>
            </div>
            <div className="dashboard-hero-metric">
              <span>Active goals</span>
              <strong>{activeGoalsCount}</strong>
            </div>
            <div className="dashboard-hero-metric">
              <span>Top goal</span>
              <strong>{primaryGoal ? `${insightGoalProgress}%` : "0%"}</strong>
            </div>
          </div>

          <div className="dashboard-balance-actions">
            <Button onClick={() => navigate("/save")} className="dashboard-save-button">
              <ActionIcon type="save" />
              <span>Save</span>
            </Button>
            <Button variant="secondary" onClick={() => navigate("/withdraw")} className="dashboard-withdraw-button">
              <ActionIcon type="withdraw" />
              <span>Withdraw</span>
            </Button>
          </div>
        </Card>

        <Card className="dashboard-trend-card dashboard-primary-card" hover>
          <div className="dashboard-trend-header dashboard-trend-header-minimal">
            <div>
              <span className="dashboard-kicker">Weekly savings</span>
              <h2 className="dashboard-trend-title">{formatCurrency(weeklySavings)}</h2>
            </div>
          </div>

          <div className="dashboard-chart-panel">
            <svg viewBox="0 0 360 160" className="dashboard-chart" aria-hidden="true">
              <defs>
                <linearGradient id="dashboardMinimalArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(37, 99, 235, 0.22)" />
                  <stop offset="100%" stopColor="rgba(37, 99, 235, 0.02)" />
                </linearGradient>
              </defs>
              <path d={`${trendPath} L 360 160 L 0 160 Z`} className="dashboard-chart-area-minimal" />
              <path d={trendPath} className="dashboard-chart-line-minimal" />
              {weeklyTrend.map((item, index) => {
                const x = (index / Math.max(weeklyTrend.length - 1, 1)) * 360;
                const y = 160 - (item.total / chartMax) * 112 - 24;
                return <circle key={item.key} cx={x} cy={y} r="3" className="dashboard-chart-dot-minimal" />;
              })}
            </svg>

            <div className="dashboard-chart-labels dashboard-chart-labels-minimal">
              {weeklyTrend.map((item) => (
                <div key={item.key} className="dashboard-chart-label dashboard-chart-label-minimal">
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.total)}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="dashboard-secondary-grid">
        <Card className="dashboard-smart-insight-card" hover>
          <div className="dashboard-smart-insight-header">
            <div className="dashboard-insight-avatar">
              <InsightIcon />
            </div>
            <span className="dashboard-insight-badge">AI Insight</span>
          </div>
          <div className="dashboard-smart-insight-body">
            <span className="dashboard-smart-insight-label">Next best move</span>
            <strong className="dashboard-smart-insight-title">{insightTitle}</strong>
            <div className="dashboard-smart-insight-lines">
              <span className="dashboard-smart-insight-highlight">{insightWeekly}</span>
              <span className="dashboard-smart-insight-text">{insightGoal}</span>
              <span className="dashboard-smart-insight-text">{insightNextStep}</span>
            </div>
            <div className="dashboard-smart-insight-actions">
              <Button
                className="dashboard-insight-cta"
                variant="secondary"
                onClick={() => navigate(primaryGoal ? `/save?goal=${primaryGoal._id}` : "/goals/new")}
              >
                {insightPrimaryAction}
              </Button>
              <button type="button" className="dashboard-insight-link" onClick={() => navigate("/goals")}>
                {insightSecondaryAction}
              </button>
            </div>
          </div>
        </Card>

        <Card hover>
          <SectionHeader
            title="Recent activity"
            subtitle="Your five latest savings records."
            actions={<Button variant="secondary" onClick={() => navigate("/activity")}>View all</Button>}
          />

          {isLoading ? (
            <div className="loading-panel">
              <span className="spinner spinner-dark" aria-hidden="true" />
              <span>Loading dashboard...</span>
            </div>
          ) : (
            <ActivityList items={recentTransactions} compact emptyMessage="No savings activity yet. Start with your first save." />
          )}
        </Card>
      </section>
    </Layout>
  );
}
