import Button from "./Button.jsx";
import ConfirmSummaryCard from "./ConfirmSummaryCard.jsx";
import { formatCurrency } from "../utils/formatters";

export default function MpesaPreview({
  chargedAmount,
  savingsAmount,
  goalName,
  isReady,
  sticky = false,
  confirmLabel,
  confirmDisabled,
  helperText,
  trustText,
}) {
  return (
    <ConfirmSummaryCard
      eyebrow="3. Confirm"
      title="Review your save"
      sticky={sticky}
      className={["mpesa-preview", sticky ? "preview-sticky" : "", isReady ? "mpesa-preview-ready" : ""].filter(Boolean).join(" ")}
      footer={
        confirmLabel ? (
          <div className="preview-confirm-stack">
            <Button type="submit" fullWidth className="preview-confirm-button" disabled={confirmDisabled}>
              {confirmLabel}
            </Button>
            <span className="preview-helper-text">{helperText || "Takes ~5 seconds"}</span>
          </div>
        ) : null
      }
    >
      <div className="preview-badge-row">
        <span className="badge badge-neutral">{goalName || "Choose a goal"}</span>
      </div>

      <div className="preview-copy">
        <p className="section-subtitle preview-subtitle">{trustText || "Secure M-Pesa transaction"}</p>
      </div>

      <div className="preview-metrics">
        <div className="preview-metric preview-metric-primary">
          <span>Total charged</span>
          <strong key={chargedAmount} className="preview-value-animated">
            {formatCurrency(chargedAmount)}
          </strong>
        </div>
        <div className="preview-metric preview-metric-success">
          <span>Amount saved</span>
          <strong key={savingsAmount} className="preview-value-animated">
            {formatCurrency(savingsAmount)}
          </strong>
        </div>
      </div>
    </ConfirmSummaryCard>
  );
}
