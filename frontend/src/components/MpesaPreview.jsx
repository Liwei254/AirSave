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
        { label: "Goal", value: goalName || "Choose a goal" },
      ]}
      buttonText={confirmLabel}
      onConfirm={onConfirm}
      disabled={confirmDisabled}
      loading={loading}
      helperText={helperText || trustText || "Secure M-Pesa transaction"}
      variant="save"
      sticky={sticky}
      className={isReady ? "confirmation-card-ready" : ""}
    />
  );
}
