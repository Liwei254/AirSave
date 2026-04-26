import Card from "./Card.jsx";

export default function SummaryCard({ eyebrow, title, sticky = false, className = "", children, footer }) {
  return (
    <Card className={["summary-card", sticky ? "summary-card-sticky" : "", className].filter(Boolean).join(" ")} hover={false}>
      {(eyebrow || title) ? (
        <div className="summary-card-header">
          {eyebrow ? <span className="summary-card-eyebrow">{eyebrow}</span> : null}
          {title ? <h3 className="summary-card-title">{title}</h3> : null}
        </div>
      ) : null}
      <div className="summary-card-body">{children}</div>
      {footer ? <div className="summary-card-footer">{footer}</div> : null}
    </Card>
  );
}
