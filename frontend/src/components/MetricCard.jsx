export default function MetricCard({ label, value, hint, className = "" }) {
  return (
    <article className={["metric-card", className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
