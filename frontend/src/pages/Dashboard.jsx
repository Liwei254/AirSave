import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Layout from "../components/Layout.jsx";

const trendData = [
  { day: "May 1", value: 90 },
  { day: "May 3", value: 190 },
  { day: "May 5", value: 290 },
  { day: "May 8", value: 450 },
  { day: "May 10", value: 620 },
  { day: "May 12", value: 560 },
  { day: "May 14", value: 740 },
  { day: "May 16", value: 810 },
  { day: "May 18", value: 940 },
  { day: "May 20", value: 980 },
  { day: "May 22", value: 1120 },
  { day: "May 24", value: 1180 },
  { day: "May 26", value: 1210 },
  { day: "May 29", value: 1250.75 },
];

const recentActivity = [
  { type: "deposit", title: "Deposit", subtitle: "From Checking Account", amount: "+$50.00", date: "May 29, 2025", tone: "green" },
  { type: "roundup", title: "Round-up", subtitle: "Coffee Shop", amount: "+$1.35", date: "May 29, 2025", tone: "blue" },
  { type: "deposit", title: "Deposit", subtitle: "From Checking Account", amount: "+$75.00", date: "May 28, 2025", tone: "orange" },
  { type: "roundup", title: "Round-up", subtitle: "Grocery Store", amount: "+$2.45", date: "May 28, 2025", tone: "purple" },
  { type: "deposit", title: "Deposit", subtitle: "From Checking Account", amount: "+$50.00", date: "May 27, 2025", tone: "green" },
];

const goals = [
  { name: "Dream Vacation", amount: "$850 of $2,000", progress: 42, tone: "blue", icon: "✈" },
  { name: "New Laptop", amount: "$450 of $1,200", progress: 38, tone: "green", icon: "⌂" },
  { name: "Emergency Fund", amount: "$1,200 of $3,000", progress: 40, tone: "orange", icon: "⬡" },
];

function StatIcon({ kind }) {
  const icons = {
    wallet: <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1H5a2 2 0 0 0-2 2V7Zm0 3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7Zm13 2a1 1 0 1 0 0 2h3v-2h-3Z" fill="currentColor" />, 
    target: <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M16 8l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
    flame: <path d="M13.5 2s.5 2.5-1 4.5S8 10 8 14a6 6 0 0 0 12 0c0-3.5-2-5.5-4-8 0 2-1 3-2.5 4-1-2-1.5-4-.5-8Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[kind]}
    </svg>
  );
}

function ActivityBadge({ type }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {type === "deposit" ? (
        <path d="M12 4v14m0 0 5-5m-5 5-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M4 6h2l2 10h8l2-7H8M10 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="mockdash-chart-tooltip">
      <span>{label}</span>
      <strong>${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Layout shellClassName="mockdash-shell">
      <section className="mockdash-welcome">
        <h1>Welcome back, Alex!</h1>
        <p>Here&apos;s what&apos;s happening with your savings today.</p>
      </section>

      <section className="mockdash-stats-row">
        <article className="mockdash-stat-card">
          <span className="mockdash-stat-icon mockdash-tone-blue"><StatIcon kind="wallet" /></span>
          <div>
            <p className="mockdash-stat-label">Total Saved</p>
            <p className="mockdash-stat-value">$1,250.75</p>
            <p className="mockdash-stat-meta">↑ 12.5% from last month</p>
          </div>
        </article>

        <article className="mockdash-stat-card">
          <span className="mockdash-stat-icon mockdash-tone-green"><StatIcon kind="target" /></span>
          <div>
            <p className="mockdash-stat-label">Active Goals</p>
            <p className="mockdash-stat-value">3</p>
            <p className="mockdash-stat-meta">2 on track</p>
          </div>
        </article>

        <article className="mockdash-stat-card">
          <span className="mockdash-stat-icon mockdash-tone-orange"><StatIcon kind="flame" /></span>
          <div>
            <p className="mockdash-stat-label">Streak</p>
            <p className="mockdash-stat-value">14 <span className="mockdash-inline-unit">days</span></p>
            <p className="mockdash-stat-meta">Keep it up!</p>
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
              <strong>$1,250.75</strong>
              <span>↑ 12.5%</span>
            </div>
            <small>vs last month ($1,111.20)</small>
          </div>

          <div className="mockdash-chart-block">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 18, right: 18, left: -14, bottom: 6 }}>
                <defs>
                  <linearGradient id="mockdashArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2f6dff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2f6dff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef3fb" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={14}
                  interval={2}
                  tick={{ fill: "#8090a8", fontSize: 13, fontWeight: 600 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value) => (value >= 1000 ? `$${value / 1000}k` : `$${value}`)}
                  tick={{ fill: "#8090a8", fontSize: 13, fontWeight: 600 }}
                />
                <Tooltip cursor={false} content={<ChartTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#2f6dff" strokeWidth={3} fill="url(#mockdashArea)" dot={false} activeDot={{ r: 7, fill: "#2f6dff", stroke: "#ffffff", strokeWidth: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <footer className="mockdash-overview-footer">
            <div>
              <p>Average Daily Savings</p>
              <strong>$41.69</strong>
            </div>
            <div>
              <p>Best Day</p>
              <strong>May 24, 2025</strong>
            </div>
            <strong className="mockdash-highlight">$78.40</strong>
          </footer>
        </article>

        <article className="mockdash-card mockdash-activity-card">
          <header className="mockdash-card-header">
            <h2>Recent Activity</h2>
            <a href="/activity">View all</a>
          </header>

          <div className="mockdash-activity-list">
            {recentActivity.map((item) => (
              <article key={`${item.title}-${item.date}-${item.amount}`} className="mockdash-activity-row">
                <span className={`mockdash-activity-icon mockdash-tone-${item.tone}`}><ActivityBadge type={item.type} /></span>
                <div className="mockdash-activity-copy">
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <div className="mockdash-activity-meta">
                  <strong>{item.amount}</strong>
                  <p>{item.date}</p>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="mockdash-card mockdash-goals-card">
        <header className="mockdash-card-header">
          <h2>Goals Progress</h2>
          <a href="/goals">View all goals</a>
        </header>

        <div className="mockdash-goals-grid">
          {goals.map((goal) => (
            <article key={goal.name} className="mockdash-goal-item">
              <span className={`mockdash-goal-icon mockdash-tone-${goal.tone}`}>{goal.icon}</span>
              <div className="mockdash-goal-copy">
                <strong>{goal.name}</strong>
                <p>{goal.amount}</p>
                <div className="mockdash-goal-progress-row">
                  <div className="mockdash-goal-track">
                    <span className={`mockdash-goal-fill mockdash-fill-${goal.tone}`} style={{ width: `${goal.progress}%` }} />
                  </div>
                  <span>{goal.progress}%</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  );
}
