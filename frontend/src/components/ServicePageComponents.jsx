import { useNavigate } from "react-router-dom";
import Layout from "./Layout.jsx";
import {
  extractKenyaPhoneDigits,
  formatAmount,
  formatKenyaPhoneDigits,
  formatKsh,
  parseAmountInput,
  toAmount,
} from "../utils/servicePage";

const amountFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

export function ServicePageShell({ current, feedback, children, parentLabel = "Payments", parentPath = "/payments" }) {
  const navigate = useNavigate();

  return (
    <Layout shellClassName="service-premium-shell">
      <div className="service-premium-page">
        {feedback ? (
          <div className={`service-feedback service-feedback-${feedback.type}`} role="status">
            <strong>{feedback.type === "success" ? "Done" : "Action needed"}</strong>
            <span>{feedback.message}</span>
          </div>
        ) : null}

        <nav className="service-premium-breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigate(parentPath)}>
            {parentLabel}
          </button>
          <span aria-hidden="true">/</span>
          <strong>{current}</strong>
        </nav>

        {children}
      </div>
    </Layout>
  );
}

export function ServiceFormCard({ label, title, badge, subtitle, children }) {
  const titleLines = Array.isArray(title) ? title : [title];

  return (
    <section className="service-form-card" aria-labelledby="service-form-title">
      <div className="service-form-heading">
        <div>
          <span className="service-kicker">{label}</span>
          <h1 id="service-form-title">
            {titleLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
        </div>
        {badge ? (
          <span className="service-status-badge">
            <i aria-hidden="true" />
            {badge}
          </span>
        ) : null}
      </div>
      {subtitle ? <p className="service-form-subtitle">{subtitle}</p> : null}
      <div className="service-form-fields">{children}</div>
    </section>
  );
}

export function AmountInput({ label = "Amount", value, onChange, placeholder = "0", error = false, disabled = false }) {
  const amount = toAmount(value);

  return (
    <label className="service-field">
      <span>{label}</span>
      <div className={["service-prefix-input", error ? "service-input-error" : ""].filter(Boolean).join(" ")}>
        <small>KES</small>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value ? amountFormatter.format(amount) : ""}
          onChange={(event) => onChange(parseAmountInput(event.target.value))}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    </label>
  );
}

export function PhoneInput({ label, value, onChange, placeholder = "712 345 678", readOnly = false, error = false }) {
  return (
    <label className="service-field">
      <span>{label}</span>
      <div
        className={[
          "service-prefix-input",
          "service-phone-input",
          readOnly ? "service-input-locked" : "",
          error ? "service-input-error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <small>+254</small>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={formatKenyaPhoneDigits(value)}
          onChange={(event) => onChange(extractKenyaPhoneDigits(event.target.value))}
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </div>
    </label>
  );
}

export function TransactionPreview({ totalLabel, totalAmount, rows, children }) {
  return (
    <aside className="service-preview-card" aria-label="Transaction preview">
      <span className="service-kicker">Transaction preview</span>
      <div className="service-preview-total">
        <span>{totalLabel}</span>
        <strong>{formatKsh(totalAmount)}</strong>
      </div>

      <dl className="service-preview-list">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.tone ? `service-preview-${row.tone}` : ""}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="service-preview-actions">{children}</div>
    </aside>
  );
}

export function RecentServiceActivity({ title, items, emptyMessage }) {
  const navigate = useNavigate();

  return (
    <section className="service-activity-card" aria-labelledby="service-activity-title">
      <div className="service-activity-heading">
        <div>
          <span className="service-kicker">Recent activity</span>
          <h2 id="service-activity-title">{title}</h2>
        </div>
        <button type="button" onClick={() => navigate("/activity")}>
          View all
        </button>
      </div>

      <div className="service-activity-list">
        {items.length ? (
          items.map((item, index) => (
            <article key={item.id || `${item.title}-${index}`}>
              <span
                className={["service-activity-dot", item.tone === "gold" ? "service-activity-dot-gold" : ""]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden="true"
              />
              <div>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
              <div>
                <strong>Ksh {formatAmount(item.amount)}</strong>
                <span>{item.helper}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="service-empty-state">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}
