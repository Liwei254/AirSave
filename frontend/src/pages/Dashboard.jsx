import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { getCurrentUser, getGoals, getSavingsActivity, getWallet } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { sortActivityByNewest, toAmount } from "../utils/savings";

function isConfirmed(item) {
  return String(item?.status || "").toLowerCase() === "confirmed";
}

function toDate(value) {
  return new Date(value?.date || value?.createdAt || value || 0);
}

function formatCurrencyUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(toDate(value));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date) {
  const normalized = startOfDay(date);
  return `${normalized.getFullYear()}-${normalized.getMonth()}-${normalized.getDate()}`;
}

function getSavingsTotal(items) {
  return (items || []).filter(isConfirmed).reduce((sum, item) => sum + toAmount(item?.savings), 0);
}

function getStreakDays(items) {
  const uniqueDays = Array.from(
    new Set((items || []).filter(isConfirmed).map((item) => dayKey(toDate(item))))
  )
    .map((key) => new Date(key))
    .sort((a, b) => b - a);

  if (!uniqueDays.length) return 0;

  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const first = startOfDay(uniqueDays[0]);
  const diffFromToday = Math.round((today - first) / (1000 * 60 * 60 * 24));
  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const current = startOfDay(uniqueDays[index - 1]);
    const previous = startOfDay(uniqueDays[index]);
    const diffDays = Math.round((current - previous) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  if (first.getTime() === yesterday.getTime()) {
    return streak;
  }

  return streak;
}

function getMonthSeries(items) {
  const currentDate = new Date();
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = new Map();

  (items || [])
    .filter(isConfirmed)
    .forEach((item) => {
      const date = toDate(item);
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      const day = date.getDate();
      byDay.set(day, (byDay.get(day) || 0) + toAmount(item.savings));
    });

  const series = [];
  let cumulative = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    cumulative += byDay.get(day) || 0;
    series.push({ day: `${currentDate.toLocaleDateString("en-US", { month: "short" })} ${day}`, value: Number(cumulative.toFixed(2)) });
  }

  return series;
}

function getGrowthPercent(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function StatIcon({ kind }) {
  const icons = {
    wallet: <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1H5a2 2 0 0 0-2 2V7Zm0 3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7Zm13 2a1 1 0 1 0 0 2h3v-2h-3Z" fill="currentColor" />, 
    target: <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M16 8l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
    flame: <path d="M13.5 2s.5 2.5-1 4.5S8 10 8 14a6 6 0 0 0 12 0c0-3.5-2-5.5-4-8 0 2-1 3-2.5 4-1-2-1.5-4-.5-8Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[kind]}</svg>;
}

function ActivityBadge({ type }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {type === "roundup" ? (
        <path d="M4 6h2l2 10h8l2-7H8M10 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M12 4v14m0 0 5-5m-5 5-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="mockdash-chart-tooltip">
      <span>{label}</span>
      <strong>{formatCurrencyUsd(payload[0].value)}</strong>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const [userData, walletData, goalsData, activityData] = await Promise.all([
        getCurrentUser(),
        getWallet(),
        getGoals(),
        getSavingsActivity(),
      ]);

      setUser(userData || null);
      setWallet(walletData || null);
      setGoals(goalsData || []);
      setActivity(sortActivityByNewest(activityData || []));
      setError("");
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        navigate("/");
        return;
      }
      setError(err?.response?.data?.message || err.message || "We could not load your dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const displayName = user?.name || user?.username || "User";
  const confirmedTotal = useMemo(() => getSavingsTotal(activity), [activity]);

  const activeGoals = useMemo(
    () => goals.filter((goal) => String(goal?.status || "active").toLowerCase() !== "completed"),
    [goals]
  );

  const streakDays = useMemo(() => getStreakDays(activity), [activity]);

  const recentActivity = useMemo(() => activity.slice(0, 5), [activity]);

  const monthSeries = useMemo(() => getMonthSeries(activity), [activity]);
  const hasChartData = monthSeries.some((point) => point.value > 0);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const previousMonth = previousMonthDate.getMonth();
  const previousYear = previousMonthDate.getFullYear();
  const currentMonthTotal = useMemo(
    () => getSavingsTotal(activity.filter((item) => {
      const date = toDate(item);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })),
    [activity, currentMonth, currentYear]
  );

  const previousMonthTotal = useMemo(
    () => getSavingsTotal(activity.filter((item) => {
      const date = toDate(item);
      return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
    })),
    [activity, previousMonth, previousYear]
  );

  const monthGrowth = getGrowthPercent(currentMonthTotal, previousMonthTotal);

  const goalsToShow = activeGoals.slice(0, 3);

  return (
    <Layout shellClassName="mockdash-shell">
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="mockdash-welcome">
        <h1>Welcome back, {displayName}!</h1>
        <p>Here&apos;s what&apos;s happening with your savings today.</p>
      </section>

      <section className="mockdash-stats-row">
        <article className="mockdash-stat-card">
          <span className="mockdash-stat-icon mockdash-tone-blue"><StatIcon kind="wallet" /></span>
          <div>
            <p className="mockdash-stat-label">Total Saved</p>
            <p className="mockdash-stat-value">{formatCurrencyUsd(confirmedTotal)}</p>
            <p className="mockdash-stat-meta">{monthGrowth >= 0 ? "↑" : "↓"} {Math.abs(monthGrowth).toFixed(1)}% from last month</p>
          </div>
        </article>

        <article className="mockdash-stat-card">
          <span className="mockdash-stat-icon mockdash-tone-green"><StatIcon kind="target" /></span>
          <div>
            <p className="mockdash-stat-label">Active Goals</p>
            <p className="mockdash-stat-value">{activeGoals.length}</p>
            <p className="mockdash-stat-meta">{activeGoals.filter((goal) => (Number(goal.savedAmount || 0) / Number(goal.targetAmount || 1)) >= 0.35).length} on track</p>
          </div>
        </article>

        <article className="mockdash-stat-card">
          <span className="mockdash-stat-icon mockdash-tone-orange"><StatIcon kind="flame" /></span>
          <div>
            <p className="mockdash-stat-label">Streak</p>
            <p className="mockdash-stat-value">{streakDays} <span className="mockdash-inline-unit">days</span></p>
            <p className="mockdash-stat-meta">{streakDays > 0 ? "Keep it up!" : "Start a new streak"}</p>
          </div>
        </article>
      </section>

      <section className="mockdash-main-row">
        <article className="mockdash-card mockdash-overview-card">
          <header className="mockdash-card-header">
            <h2>Savings Overview</h2>
            <button type="button" className="mockdash-month-pill">This Month</button>
          </header>

          <div className="mockdash-overview-total">
            <p>Total Savings</p>
            <div>
              <strong>{formatCurrencyUsd(currentMonthTotal)}</strong>
              <span>{monthGrowth >= 0 ? "↑" : "↓"} {Math.abs(monthGrowth).toFixed(1)}%</span>
            </div>
            <small>vs last month ({formatCurrencyUsd(previousMonthTotal)})</small>
          </div>

          <div className="mockdash-chart-block">
            {isLoading ? (
              <div className="empty-state">Loading savings data...</div>
            ) : hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthSeries} margin={{ top: 18, right: 18, left: -14, bottom: 6 }}>
                  <defs>
                    <linearGradient id="mockdashArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2f6dff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2f6dff" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef3fb" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={14} interval={6} tick={{ fill: "#8090a8", fontSize: 13, fontWeight: 600 }} />
                  <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value) => (value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`)} tick={{ fill: "#8090a8", fontSize: 13, fontWeight: 600 }} />
                  <Tooltip cursor={false} content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#2f6dff" strokeWidth={3} fill="url(#mockdashArea)" dot={false} activeDot={{ r: 7, fill: "#2f6dff", stroke: "#ffffff", strokeWidth: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No savings data yet.</div>
            )}
          </div>

          <footer className="mockdash-overview-footer">
            <div>
              <p>Wallet Balance</p>
              <strong>{formatCurrency(wallet?.balance || 0)}</strong>
            </div>
            <div>
              <p>Best Day</p>
              <strong>{hasChartData ? formatShortDate(sortActivityByNewest(activity.filter(isConfirmed))[0]) : "No data"}</strong>
            </div>
            <strong className="mockdash-highlight">{formatCurrencyUsd(Math.max(...monthSeries.map((point) => point.value), 0))}</strong>
          </footer>
        </article>

        <article className="mockdash-card mockdash-activity-card">
          <header className="mockdash-card-header">
            <h2>Recent Activity</h2>
            <button type="button" className="mockdash-link-button" onClick={() => navigate("/activity")}>View all</button>
          </header>

          <div className="mockdash-activity-list">
            {isLoading ? (
              <div className="empty-state">Loading activity...</div>
            ) : recentActivity.length ? recentActivity.map((item, index) => {
              const tone = ["green", "blue", "orange", "purple", "green"][index % 5];
              const type = String(item?.type || item?.category || "deposit").toLowerCase().includes("round") ? "roundup" : "deposit";
              return (
                <article key={item?._id || `${item?.date}-${index}`} className="mockdash-activity-row">
                  <span className={`mockdash-activity-icon mockdash-tone-${tone}`}><ActivityBadge type={type} /></span>
                  <div className="mockdash-activity-copy">
                    <strong>{item?.goalName || item?.type || "Savings"}</strong>
                    <p>{item?.source || item?.status || "Savings activity"}</p>
                  </div>
                  <div className="mockdash-activity-meta">
                    <strong>{formatCurrencyUsd(item?.savings || item?.amount || 0)}</strong>
                    <p>{formatShortDate(item?.date || item?.createdAt)}</p>
                  </div>
                </article>
              );
            }) : <div className="empty-state">No activity yet.</div>}
          </div>
        </article>
      </section>

      <section className="mockdash-card mockdash-goals-card">
        <header className="mockdash-card-header">
          <h2>Goals Progress</h2>
          <button type="button" className="mockdash-link-button" onClick={() => navigate("/goals")}>View all goals</button>
        </header>

        <div className="mockdash-goals-grid">
          {isLoading ? (
            <div className="empty-state">Loading goals...</div>
          ) : goalsToShow.length ? goalsToShow.map((goal, index) => {
            const progress = Math.min(100, Math.round((Number(goal.savedAmount || 0) / Math.max(Number(goal.targetAmount || 0), 1)) * 100));
            const tones = ["blue", "green", "orange"];
            const tone = tones[index % tones.length];
            return (
              <article key={goal._id || goal.name} className="mockdash-goal-item">
                <span className={`mockdash-goal-icon mockdash-tone-${tone}`}>{["✈", "⌂", "⬡"][index % 3]}</span>
                <div className="mockdash-goal-copy">
                  <strong>{goal.name}</strong>
                  <p>{formatCurrencyUsd(goal.savedAmount || 0)} of {formatCurrencyUsd(goal.targetAmount || 0)}</p>
                  <div className="mockdash-goal-progress-row">
                    <div className="mockdash-goal-track">
                      <span className={`mockdash-goal-fill mockdash-fill-${tone}`} style={{ width: `${progress}%` }} />
                    </div>
                    <span>{progress}%</span>
                  </div>
                </div>
              </article>
            );
          }) : <div className="empty-state">No goals yet.</div>}
        </div>
      </section>

      <section className="mockdash-quick-actions">
        <button type="button" className="ui-button ui-button-primary" onClick={() => navigate("/save")}>Save</button>
        <button type="button" className="ui-button ui-button-secondary" onClick={() => navigate("/withdraw")}>Withdraw</button>
      </section>
    </Layout>
  );
}
