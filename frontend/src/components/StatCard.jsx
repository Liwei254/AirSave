import Card from "./Card.jsx";

export default function StatCard({ label, value, hint, tone = "default", action }) {
  return (
    <Card className={["stat-card", `stat-card-${tone}`].join(" ")}>
      <span className="metric-label">{label}</span>
      <p className="metric-value metric-value-sm">{value}</p>
      <div className="metric-meta">{hint}</div>
      {action ? <div className="stat-card-action">{action}</div> : null}
    </Card>
  );
}
