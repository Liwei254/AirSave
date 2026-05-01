import ConfirmationCard from "./ConfirmationCard.jsx";
import { formatCurrency } from "../utils/formatters";

export default function MpesaPreview({
  chargedAmount,
  savingsAmount,
  goalName,
  isReady,
  sticky = false,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  loading = false,
  helperText,
  trustText,
}) {
  return (
    <ConfirmationCard
      label="M-PESA PREVIEW"
      title="Review save"
      amount={chargedAmount}
      rows={[
        { label: "Amount saved", value: formatCurrency(savingsAmount) },
        { label: "Fee", value: formatCurrency(0) },
        { label: "Destination", value: goalName || "Active goal or savings wallet" },
      ]}
      buttonText={confirmLabel}
      onConfirm={onConfirm}
      disabled={confirmDisabled}
      loading={loading}
      helperText={helperText || trustText || "Secure M-Pesa transaction"}
      variant="save"
      sticky={sticky}
      className={["save-summary-card", isReady ? "confirmation-card-ready" : ""].filter(Boolean).join(" ")}
    />
  );
}
