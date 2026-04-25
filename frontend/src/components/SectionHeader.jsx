export default function SectionHeader({ eyebrow, title, subtitle, actions, className = "" }) {
  return (
    <div className={["section-header", className].filter(Boolean).join(" ")}>
      <div className="section-header-copy">
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        {title ? <h2 className="section-title">{title}</h2> : null}
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  );
}
