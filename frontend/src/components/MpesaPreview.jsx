import Card from "./Card.jsx";
import Button from "./Button.jsx";
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
    <Card className={["mpesa-preview", sticky ? "preview-sticky" : "", isReady ? "mpesa-preview-ready" : "", "dominant-preview-card"].filter(Boolean).join(" ")}>
      <div className="preview-badge-row">
        <span className="preview-badge">3. Confirm</span>
        <span className="badge badge-neutral">{goalName || "Choose a goal"}</span>
      </div>

      <div className="preview-copy">
        <h3 className="section-title preview-title">Review your save</h3>
        <p className="section-subtitle preview-subtitle">{trustText || "Secure M-Pesa transaction"}</p>
      </div>

      <div className="preview-metrics">
        <div className="preview-metric preview-metric-primary">
          <span>Total charged</span>
          <strong key={chargedAmount} className="preview-value-animated">{formatCurrency(chargedAmount)}</strong>
        </div>
        <div className="preview-metric preview-metric-success">
          <span>Amount saved</span>
          <strong key={savingsAmount} className="preview-value-animated">{formatCurrency(savingsAmount)}</strong>
        </div>
      </div>

      {confirmLabel ? (
        <div className="preview-confirm-stack">
          <Button type="submit" fullWidth className="preview-confirm-button" disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
          <span className="preview-helper-text">{helperText || "Takes ~5 seconds"}</span>
        </div>
      ) : null}
    </Card>
  );
}
