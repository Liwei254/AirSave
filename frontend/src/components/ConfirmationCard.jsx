import { useId } from "react";
import { formatCurrency } from "../utils/formatters";

function formatDisplayAmount(amount) {
  if (amount === null || amount === undefined || amount === "") {
    return "Ksh 0";
  }

  return typeof amount === "number" ? formatCurrency(amount) : amount;
}

export default function ConfirmationCard({
  label,
  title,
  amount,
  rows = [],
  buttonText,
  onConfirm,
  disabled = false,
  loading = false,
  helperText,
  variant = "default",
  sticky = false,
  className = "",
}) {
  const titleId = useId();
  const amountId = useId();
  const hasAmount = amount !== null && amount !== undefined && amount !== "";

  return (
    <section
      className={[
        "confirmation-card",
        `confirmation-card-${variant}`,
        sticky ? "confirmation-card-sticky" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
      aria-describedby={hasAmount ? amountId : undefined}
    >
      <div className="confirmation-card-copy">
        {label ? <span className="confirmation-card-label">{label}</span> : null}
        {title ? (
          <h3 id={titleId} className="confirmation-card-title">
            {title}
          </h3>
        ) : null}
        {hasAmount ? (
          <p id={amountId} className="confirmation-card-amount">
            {formatDisplayAmount(amount)}
          </p>
        ) : null}
      </div>

      {rows.length ? (
        <div className="confirmation-card-rows">
          {rows.map((row) => (
            <div key={row.label} className="confirmation-card-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {(helperText || buttonText) ? (
        <div className="confirmation-card-actions">
          {helperText ? <p className="confirmation-card-helper">{helperText}</p> : null}
          {buttonText ? (
            <button
              type="button"
              className="confirmation-card-button"
              onClick={onConfirm}
              disabled={disabled || loading}
              aria-busy={loading}
            >
              {loading ? <span className="spinner confirmation-card-spinner" aria-hidden="true" /> : null}
              <span>{buttonText}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
