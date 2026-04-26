export default function FormSection({ title, caption, active = true, className = "", children }) {
  return (
    <section className={["form-section", active ? "form-section-active" : "form-section-inactive", className].filter(Boolean).join(" ")}>
      {(title || caption) ? (
        <div className="form-section-header">
          {title ? <h3 className="form-section-title">{title}</h3> : null}
          {caption ? <span className="form-section-caption">{caption}</span> : null}
        </div>
      ) : null}
      <div className="form-section-body">{children}</div>
    </section>
  );
}
