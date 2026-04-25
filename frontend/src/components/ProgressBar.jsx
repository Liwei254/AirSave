export default function ProgressBar({ value, complete = false, className = "" }) {
  return (
    <div className={["ui-progress", className].filter(Boolean).join(" ")} role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100">
      <div className={["ui-progress-bar", complete ? "ui-progress-bar-complete" : ""].filter(Boolean).join(" ")} style={{ width: `${value}%` }} />
    </div>
  );
}
