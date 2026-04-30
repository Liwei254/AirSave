import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActivityList from "../components/ActivityList.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import Layout from "../components/Layout.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { getGoals, getSavingsActivity, getWallet } from "../services/api";
import { formatCurrency, getGoalProgress } from "../utils/formatters";
import { getSavingsSummary, sortActivityByNewest } from "../utils/savings";

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

const TRENDLINE_WIDTH = 280;
const TRENDLINE_HEIGHT = 80;

function formatPoint(value) {
  return Number(value.toFixed(2));
}

function buildSparklinePoints(values) {
  if (!values.length) return [];

  const topPadding = 10;
  const bottomPadding = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const drawableHeight = TRENDLINE_HEIGHT - topPadding - bottomPadding;

  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * TRENDLINE_WIDTH;
    const y = range === 0
      ? TRENDLINE_HEIGHT / 2
      : TRENDLINE_HEIGHT - bottomPadding - ((value - min) / range) * drawableHeight;

    return { x: formatPoint(x), y: formatPoint(y) };
  });
}

function buildSmoothSparklinePath(points) {
  if (!points.length) return "";

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const controlX = formatPoint((previous.x + point.x) / 2);
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
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

  const totalSaved = useMemo(() => getSavingsSummary(activity), [activity]);
  const weeklyTrend = useMemo(() => buildWeeklyTrend(activity), [activity]);
  const weeklySavings = useMemo(
    () => weeklyTrend.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [weeklyTrend]
  );
  const trendPoints = useMemo(() => buildSparklinePoints(weeklyTrend.map((item) => item.total)), [weeklyTrend]);
  const trendPath = useMemo(() => buildSmoothSparklinePath(trendPoints), [trendPoints]);
  const primaryGoal = goals[0] || null;
  const activeGoalsCount = goals.filter((goal) => goal.status !== "completed").length;
  const recentTransactions = activity.slice(0, 5);
  const balanceDisplay = balanceVisible ? formatCurrency(wallet?.balance) : "Ksh ******";
  const insightGoalProgress = primaryGoal ? getGoalProgress(primaryGoal) : 0;
  const topGoalName = primaryGoal ? primaryGoal.name : "No active goals yet";
  const topGoalInsight = primaryGoal
    ? `${insightGoalProgress}% of ${primaryGoal.name} is funded.`
    : "Create a goal to start tracking progress.";

  return (
    <Layout
      
    >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="dashboard-minimal-grid">
        <Card className="dashboard-balance-card dashboard-primary-card dashboard-balance-hero" hover>
          <div className="dashboard-balance-shell">
            <div className="dashboard-balance-copy">
              <span className="dashboard-kicker">AVAILABLE BALANCE</span>
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

              <div className="dashboard-balance-inline-stats" aria-label="Savings summary">
                <p>
                  <span>Saved total</span>
                  {formatCurrency(totalSaved)}
                </p>
                <p>
                  <span>This week</span>
                  {formatCurrency(weeklySavings)}
                </p>
                <p>
                  <span>Active goals</span>
                  {activeGoalsCount}/5
                </p>
              </div>
            </div>

            <div className="dashboard-hero-right">
              <div className="dashboard-hero-trend" aria-hidden="true">
                <svg viewBox={`0 0 ${TRENDLINE_WIDTH} ${TRENDLINE_HEIGHT}`} className="dashboard-hero-trendline">
                  <path d={trendPath} className="dashboard-chart-line-minimal" />
                </svg>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="dashboard-quick-actions" aria-label="Quick actions">
        <button type="button" onClick={() => navigate("/send")}>
          <span>Send</span>
        </button>
        <button type="button" onClick={() => navigate("/lipa-na-airsave")}>
          <span>Buy Goods</span>
        </button>
        <button type="button" onClick={() => navigate("/withdraw")}>
          <span>Withdraw</span>
        </button>
      </section>

      <section className="dashboard-secondary-grid">
        <Card className="dashboard-smart-insight-card" hover>
          <div className="dashboard-smart-insight-header">
            <span className="dashboard-insight-badge">Goals progress</span>
          </div>
          <div className="dashboard-smart-insight-body">
            <span className="dashboard-smart-insight-label">Top goal</span>
            <strong className="dashboard-smart-insight-title">{topGoalName}</strong>
            <div className="dashboard-smart-insight-progress">
              <span>Current progress</span>
              <strong>{insightGoalProgress}%</strong>
            </div>
            <span className="dashboard-smart-insight-text">{topGoalInsight}</span>
            <div className="dashboard-smart-insight-actions">
              <Button
                className="dashboard-insight-cta"
                variant="secondary"
                onClick={() => navigate(primaryGoal ? `/save?goal=${primaryGoal._id}` : "/goals/new")}
              >
                {primaryGoal ? "Save to goal" : "Create goal"}
              </Button>
              <button type="button" className="dashboard-insight-link" onClick={() => navigate("/goals")}>
                View goals
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
