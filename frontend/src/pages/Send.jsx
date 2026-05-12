import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useActivityQuery,
  useProfileQuery,
  useSendMoneyMutation,
  useWalletQuery,
} from "../api/hooks";
import {
  AmountInput,
  PhoneInput,
  RecentServiceActivity,
  ServiceFormCard,
  ServicePageShell,
  TransactionPreview,
} from "../components/ServicePageComponents.jsx";
import {
  extractKenyaPhoneDigits,
  formatKsh,
  formatServiceDate,
  getFullKenyaPhone,
  isValidKenyaPhoneDigits,
  toAmount,
} from "../utils/servicePage";
import { fetchPaymentStatus } from "../api/paymentsApi";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { sortActivityByNewest } from "../utils/savings";

const paymentPollDelayMs = 1000;
const paymentPollAttempts = 7;
const terminalPaymentStatuses = ["confirmed", "completed", "success", "successful", "failed"];

function wait(delay) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function getStatusText(status) {
  return String(status || "pending").toLowerCase();
}

function buildTransferRows(activity) {
  return (activity || [])
    .filter((item) => String(item.transactionType || "").toLowerCase() === "send")
    .slice(0, 5)
    .map((item) => ({
      id: item._id || item.reference,
      title: item.merchant || "Mobile transfer",
      meta: `${formatServiceDate(item.date || item.createdAt)} - ${getStatusText(item.status)}`,
      amount: item.purchaseAmount ?? item.originalAmount ?? item.amount ?? 0,
      helper: "Transfer",
      tone: "green",
    }));
}

export default function Send() {
  const navigate = useNavigate();
  const [recipientMode, setRecipientMode] = useState("self");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const profileQuery = useProfileQuery();
  const walletQuery = useWalletQuery();
  const activityQuery = useActivityQuery();
  const sendMoneyMutation = useSendMoneyMutation();

  useEffect(() => {
    const loadError = profileQuery.error || walletQuery.error || activityQuery.error;
    if (!loadError) return;

    if (loadError.response?.status === 401 || loadError.response?.status === 403) {
      navigate("/");
      return;
    }

    setFeedback({ type: "error", message: loadError.message || "We could not load your account." });
  }, [activityQuery.error, navigate, profileQuery.error, walletQuery.error]);

  const user = profileQuery.data;
  const wallet = walletQuery.data;
  const activity = useMemo(() => sortActivityByNewest(activityQuery.data || []), [activityQuery.data]);
  const isLoading = profileQuery.isLoading || walletQuery.isLoading || activityQuery.isLoading;

  useEffect(() => {
    if (recipientMode === "self") {
      setRecipientPhone(extractKenyaPhoneDigits(user?.phone || ""));
    } else {
      setRecipientPhone("");
    }
  }, [recipientMode, user?.phone]);

  async function refreshActivity() {
    try {
      await activityQuery.refetch();
    } catch {
      // The transfer result is already shown; keep the current activity list if refresh fails.
    }
  }

  const numericAmount = toAmount(amount);
  const validPhone = isValidKenyaPhoneDigits(recipientPhone);
  const recipientDisplay = getFullKenyaPhone(recipientPhone) || "Not set";
  const fee = 0;
  const totalCharged = numericAmount + fee;
  const walletBalance = Number(wallet?.balance || 0);
  const exceedsBalance = numericAmount > 0 && totalCharged > walletBalance;
  const canConfirm = numericAmount > 0 && validPhone && !exceedsBalance && !isSubmitting;
  const recentRows = useMemo(() => buildTransferRows(activity), [activity]);
  const previewRows = [
    { label: "Recipient", value: recipientDisplay },
    { label: "Amount", value: formatKsh(numericAmount) },
    { label: "Transfer type", value: recipientMode === "self" ? "Send to myself" : "Mobile transfer" },
    { label: "Fee", value: formatKsh(fee) },
    { label: "Wallet balance", value: formatKsh(walletBalance) },
    { label: "Total charged", value: formatKsh(totalCharged) },
  ];

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!numericAmount || !validPhone || exceedsBalance) {
      setFeedback({
        type: "error",
        message: exceedsBalance
          ? "Transfer amount exceeds your wallet balance."
          : "Enter a valid recipient and amount before confirming.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payment = await sendMoneyMutation.mutateAsync({
        amount: numericAmount,
        phone: recipientDisplay,
        merchant: recipientMode === "self" ? "Send to myself" : `Send to ${recipientDisplay}`,
        description: note.trim() || (recipientMode === "self" ? "Send to myself" : `Send to another number ${recipientDisplay}`),
        transactionType: "send",
        mode: "send-mobile",
      });

      const paymentReference = payment.paymentReference || payment.reference;

      if (paymentReference) {
        for (let attempt = 0; attempt < paymentPollAttempts; attempt += 1) {
          await wait(paymentPollDelayMs);
          const statusResult = await fetchPaymentStatus(paymentReference);
          const normalizedStatus = String(statusResult.status || "").toLowerCase();

          if (terminalPaymentStatuses.includes(normalizedStatus)) {
            payment.status = statusResult.status;
            break;
          }
        }
      }

      setAmount("");
      setNote("");
      setSubmitted(false);
      await refreshActivity();
      triggerDashboardRefresh();
      setFeedback({
        type: "success",
        message:
          String(payment.status || "").toLowerCase() === "confirmed"
            ? "Transfer confirmed successfully."
            : "Transfer request sent. Confirmation is in progress.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete this transfer.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ServicePageShell current="Send Money" feedback={feedback}>
      {isLoading ? (
        <section className="service-loading-card">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading send flow...</span>
        </section>
      ) : (
        <>
          <form className="service-layout-grid" onSubmit={handleSubmit}>
            <ServiceFormCard
              label="Wallet service"
              title={["Send to", "Mobile"]}
              badge="Instant transfer"
              subtitle="Send money to yourself or another mobile number."
            >
              <div className="service-mode-selector" aria-label="Send mode">
                <button
                  type="button"
                  className={recipientMode === "self" ? "service-mode-active" : ""}
                  onClick={() => setRecipientMode("self")}
                >
                  Send to myself
                </button>
                <button
                  type="button"
                  className={recipientMode === "other" ? "service-mode-active" : ""}
                  onClick={() => setRecipientMode("other")}
                >
                  Send to another number
                </button>
              </div>

              <PhoneInput
                label="Recipient Phone Number"
                value={recipientPhone}
                onChange={setRecipientPhone}
                readOnly={recipientMode === "self"}
                error={submitted && !validPhone}
              />

              <AmountInput
                value={amount}
                onChange={setAmount}
                error={(submitted && !numericAmount) || exceedsBalance}
              />
              {exceedsBalance ? (
                <p className="service-field-helper service-field-helper-error">
                  Amount exceeds your wallet balance.
                </p>
              ) : null}

              <label className="service-field">
                <span>Optional Note</span>
                <textarea
                  className="service-dark-input service-note-input"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a note"
                  rows={4}
                />
              </label>
            </ServiceFormCard>

            <TransactionPreview totalLabel="Amount Sent" totalAmount={numericAmount} rows={previewRows}>
              <button className="service-primary-action" type="submit" disabled={!canConfirm}>
                {isSubmitting ? "Confirming..." : "Confirm Send"}
              </button>
              <button className="service-secondary-action" type="button" onClick={() => navigate("/dashboard")}>
                Cancel
              </button>
            </TransactionPreview>
          </form>

          <RecentServiceActivity
            title="Recent transfers"
            items={recentRows}
            emptyMessage="No mobile transfers yet."
          />
        </>
      )}
    </ServicePageShell>
  );
}
