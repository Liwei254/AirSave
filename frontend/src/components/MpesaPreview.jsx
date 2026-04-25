import { formatCurrency } from "../utils/formatters";

export default function MpesaPreview({ chargedAmount, savingsAmount, goalName, isReady }) {
  return (
    <div className={`mpesa-preview-card ${isReady ? "mpesa-preview-card-ready" : ""}`}>
      <div className="mpesa-preview-header">
        <div>
          <h3 className="mpesa-preview-title">M-Pesa preview</h3>
          <p className="mpesa-preview-subtitle">You will receive an M-Pesa prompt on your phone before we save the funds.</p>
        </div>
        <span className="badge badge-neutral">{goalName || "Choose a goal"}</span>
      </div>

      <div className="mpesa-preview-values">
        <div className="mpesa-preview-total">
          <span>Total charged</span>
          <strong>{formatCurrency(chargedAmount)}</strong>
        </div>
        <div className="mpesa-preview-savings">
          <span>Amount saved</span>
          <strong>{formatCurrency(savingsAmount)}</strong>
        </div>
      </div>

      <p className="mpesa-preview-note">Includes transaction fee. Confirm the prompt to complete your save.</p>
    </div>
  );
}

