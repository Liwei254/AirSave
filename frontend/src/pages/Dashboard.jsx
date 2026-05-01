import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getActiveGoal,
  getSavingsActivity,
  getWallet,
} from "../services/api";
import { getGoalProgress } from "../utils/formatters";
import {
  getActivityDate,
  getSavingsSummary,
  isConfirmedSavingsStatus,
  sortActivityByNewest,
} from "../utils/savings";

const QUICK_ACTIONS = [
  { label: "Send", to: "/send", icon: "send", tone: "gold" },
  { label: "Buy Goods", to: "/lipa-na-airsave", icon: "cart", tone: "green" },
  { label: "Withdraw", to: "/withdraw", icon: "withdraw", tone: "red" },
];

const TRENDLINE_WIDTH = 430;
const TRENDLINE_HEIGHT = 130;

function Icon({ name, className = "" }) {
  const paths = {
    bell: [
      "M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z",
      "M10 20a2 2 0 0 0 4 0",
    ],
    cart: [
      "M5 6h2l1.8 8.5a2 2 0 0 0 2 1.5h5.6a2 2 0 0 0 1.9-1.4L20 9H8",
      "M11 20h.01",
      "M17 20h.01",
    ],
    chevron: ["M8 5l8 7-8 7"],
    eye: [
      "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z",
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    ],
    eyeOff: [
      "M2 12s3.5-6 10-6c2.2 0 4 .7 5.5 1.7",
      "M22 12s-3.5 6-10 6c-2.2 0-4-.7-5.5-1.7",
      "M4 4l16 16",
      "M9.8 9.8A3 3 0 0 0 14.2 14.2",
    ],
    send: ["M4 12h15", "M13 6l6 6-6 6"],
    withdraw: ["M12 4v12", "M7 11l5 5 5-5", "M5 20h14"],
  };

  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {(paths[name] || []).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.goals)) return value.goals;
  if (Array.isArray(value?.activity)) return value.activity;
  if (Array.isArray(value?.transactions)) return value.transactions;
  return [];
}

function getWalletBalance(wallet) {
  return Number(wallet?.balance ?? wallet?.wallet?.balance ?? wallet?.availableBalance ?? 0);
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  });
}

function formatKsh(value) {
  return `Ksh ${formatAmount(value)}`;
}

function formatPoint(value) {
  return Number(value.toFixed(2));
}

function buildWeeklyTrend(items) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      total: 0,
    };
  });
  const dayMap = new Map(days.map((day) => [day.key, day]));

  (items || []).forEach((item) => {
    if (!isConfirmedSavingsStatus(item.status)) return;

    const date = getActivityDate(item);
    if (Number.isNaN(date.getTime())) return;

    date.setHours(0, 0, 0, 0);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const targetDay = dayMap.get(key);

    if (targetDay) {
      targetDay.total += Number(item.savings ?? item.amount ?? 0);
    }
  });

  return days;
}

function buildSparklinePoints(values) {
  if (!values.length) return [];

  const topPadding = 18;
  const bottomPadding = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const drawableHeight = TRENDLINE_HEIGHT - topPadding - bottomPadding;

  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * TRENDLINE_WIDTH;
    const y =
      range === 0
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

function formatActivityDate(item) {
  const date = getActivityDate(item);
  if (Number.isNaN(date.getTime())) return "Just now";

  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function BalanceHero({
  balance,
  balanceVisible,
  onToggleBalance,
  totalSaved,
  weeklySavings,
  currentGoal,
  goalProgress,
  trendPath,
}) {
  return (
    <section className="premium-balance-hero" aria-labelledby="dashboard-balance-title">
      <div className="premium-balance-content">
        <p className="premium-dashboard-kicker">Available balance</p>
        <div className="premium-balance-line">
          <h1 id="dashboard-balance-title" className="premium-balance-amount">
            <span>Ksh</span> {balanceVisible ? formatAmount(balance) : "*******"}
          </h1>
          <button
            type="button"
            className="premium-balance-toggle"
            onClick={onToggleBalance}
            aria-label={balanceVisible ? "Hide balance" : "Show balance"}
          >
            <Icon name={balanceVisible ? "eye" : "eyeOff"} />
          </button>
        </div>
        <p className="premium-balance-subtext">Updated from confirmed savings activity</p>

        <div className="premium-balance-stats" aria-label="Savings summary">
          <article>
            <span>Saved total</span>
            <strong>{formatKsh(totalSaved)}</strong>
          </article>
          <article>
            <span>This week</span>
            <strong>{formatKsh(weeklySavings)}</strong>
          </article>
          <article>
            <span>{currentGoal ? "Goal progress" : "Goal status"}</span>
            <strong>{currentGoal ? `${goalProgress}%` : "None"}</strong>
          </article>
        </div>
      </div>

      <div className="premium-balance-visual" aria-hidden="true">
        <div className="premium-balance-glow" />
        <svg viewBox={`0 0 ${TRENDLINE_WIDTH} ${TRENDLINE_HEIGHT}`} preserveAspectRatio="none">
          <path d={trendPath} />
        </svg>
      </div>
    </section>
  );
}

function QuickActionCard({ action }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={`premium-action-card premium-action-${action.tone}`}
      onClick={() => navigate(action.to)}
    >
      <span className="premium-action-icon">
        <Icon name={action.icon} />
      </span>
      <strong>{action.label}</strong>
    </button>
  );
}

function GoalCard({ goal, progress }) {
  const navigate = useNavigate();
  const goalName = goal?.name || "No active goal";
  const safeProgress = Math.min(100, Math.max(0, progress || 0));
  const activeCopy = goal ? "Active" : "Ready to start";

  return (
    <section className="premium-dashboard-card premium-goal-card" aria-labelledby="top-goal-title">
      <p className="premium-dashboard-kicker">Current goal</p>
      <h2 id="top-goal-title">{goalName}</h2>
      <p className="premium-goal-meta">
        {activeCopy} {goal ? <><span aria-hidden="true">&middot;</span> Savings goal</> : null}
      </p>

      <div className="premium-goal-progress-header">
        <span>Current progress</span>
        <strong>{safeProgress}%</strong>
      </div>
      <div className="premium-goal-progress-track" aria-label={`${safeProgress}% funded`}>
        <span style={{ width: `${safeProgress}%` }} />
      </div>
      <p className="premium-goal-helper">
        {goal ? (
          <>
            {safeProgress}% of <strong>{goalName}</strong> is funded. Keep contributing to reach your target.
          </>
        ) : (
          "Create a savings goal to start tracking your progress."
        )}
      </p>

      <div className="premium-goal-actions">
        <button
          type="button"
          onClick={() => navigate(goal ? "/save" : "/save/create")}
        >
          {goal ? "Add savings" : "Create goal"}
        </button>
        <button type="button" onClick={() => navigate("/save")}>
          View goal
        </button>
      </div>
    </section>
  );
}

function ActivityList({ items, isLoading }) {
  const navigate = useNavigate();
  const displayItems = items.slice(0, 5);

  return (
    <section className="premium-dashboard-card premium-activity-card" aria-labelledby="recent-activity-title">
      <div className="premium-activity-header">
        <div>
          <h2 id="recent-activity-title">Recent activity</h2>
          <p>Your five latest savings records</p>
        </div>
        <button type="button" onClick={() => navigate("/activity")}>
          View all
        </button>
      </div>

      {isLoading ? (
        <div className="premium-activity-state">Loading dashboard...</div>
      ) : null}

      {!isLoading && !displayItems.length ? (
        <div className="premium-activity-state">No savings activity yet.</div>
      ) : null}

      {!isLoading && displayItems.length ? (
        <div className="premium-activity-list">
          {displayItems.map((item, index) => {
            const goalName = item.goalName || item.goal?.name || "Savings";
            const amount = Number(item.savings ?? item.amount ?? 0);
            const status = String(item.status || "confirmed").toLowerCase();
            const confirmed = isConfirmedSavingsStatus(status);

            return (
              <article key={item._id || item.id || `${goalName}-${index}`}>
                <span
                  className={
                    goalName.toLowerCase().includes("vacation")
                      ? "premium-activity-dot premium-activity-dot-gold"
                      : "premium-activity-dot"
                  }
                  aria-hidden="true"
                />
                <div className="premium-activity-copy">
                  <strong>{goalName}</strong>
                  <span>
                    {formatActivityDate(item)} <span aria-hidden="true">&middot;</span>{" "}
                    {item.source || "M-Pesa transfer"}
                  </span>
                </div>
                <div className="premium-activity-amount">
                  <strong>{formatKsh(amount)}</strong>
                  <span className={confirmed ? "premium-confirmed-badge" : "premium-pending-badge"}>
                    {confirmed ? "confirmed" : status || "pending"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [balanceVisible, setBalanceVisible] = useState(false);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      const [walletData, goalData, activityData] = await Promise.all([
        getWallet(),
        getActiveGoal(),
        getSavingsActivity(),
      ]);

      setWallet(walletData);
      setActiveGoal(goalData);
      setActivity(sortActivityByNewest(normalizeArray(activityData)));
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
  const trendPath = useMemo(() => {
    const weeklyValues = weeklyTrend.map((item) => item.total);
    const chartValues = weeklyValues.some((value) => value > 0)
      ? weeklyValues
      : [12, 28, 22, 44, 38, 64, 52];
    return buildSmoothSparklinePath(buildSparklinePoints(chartValues));
  }, [weeklyTrend]);
  const primaryGoal = activeGoal?.status === "active" ? activeGoal : null;
  const goalProgress = primaryGoal ? getGoalProgress(primaryGoal) : 0;
  const balance = getWalletBalance(wallet);

  return (
    <main className="premium-dashboard-shell">
      <div className="premium-dashboard-page">
        {error ? (
          <div className="premium-dashboard-alert" role="alert">
            <strong>Error</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <BalanceHero
          balance={balance}
          balanceVisible={balanceVisible}
          onToggleBalance={() => setBalanceVisible((current) => !current)}
          totalSaved={totalSaved}
          weeklySavings={weeklySavings}
          currentGoal={primaryGoal}
          goalProgress={goalProgress}
          trendPath={trendPath}
        />

        <section className="premium-actions-grid" aria-label="Quick actions">
          {QUICK_ACTIONS.map((action) => (
            <QuickActionCard key={action.to} action={action} />
          ))}
        </section>

        <section className="premium-dashboard-lower-grid">
          <GoalCard
            goal={primaryGoal}
            progress={goalProgress}
          />
          <ActivityList items={activity.slice(0, 5)} isLoading={isLoading} />
        </section>
      </div>
    </main>
  );
}
