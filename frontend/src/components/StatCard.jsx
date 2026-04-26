import Card from "./Card.jsx";

const toneIcons = {
  default: "A",
  cool: "$",
  success: "✓",
};

export default function StatCard({ label, value, hint, tone = "default", action }) {
  return (
    <Card className={["stat-card", `stat-card-${tone}`].join(" ")}>
      <div className="stat-card-head">
        <span className="metric-label">{label}</span>
        <span className={["stat-card-icon", `stat-card-icon-${tone}`].join(" ")}>{toneIcons[tone] || toneIcons.default}</span>
      </div>
      <p className="metric-value metric-value-sm">{value}</p>
      <div className="metric-meta">{hint}</div>
      {action ? <div className="stat-card-action">{action}</div> : null}
    </Card>
  );
}
