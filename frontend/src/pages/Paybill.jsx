import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useActivityQuery,
  usePaybillMutation,
  useProfileQuery,
  useWalletQuery,
} from "../api/hooks";
import {
  AmountInput,
  RecentServiceActivity,
  ServiceFormCard,
  ServicePageShell,
  TransactionPreview,
} from "../components/ServicePageComponents.jsx";
import { fetchPaymentStatus } from "../api/paymentsApi";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { formatKsh, formatServiceDate, getRoundUp, toAmount } from "../utils/servicePage";
import { isConfirmedSavingsStatus, sortActivityByNewest } from "../utils/savings";

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

function buildPaybillRows(activity) {
  return (activity || [])
    .filter((item) => String(item.transactionType || "").toLowerCase() === "bill")
    .slice(0, 5)
    .map((item) => ({
      id: item._id || item.reference,
      title: item.merchant || "Paybill",
      meta: `${formatServiceDate(item.date || item.createdAt)} - ${getStatusText(item.status)}`,
      amount: item.savings ?? item.savingsAmount ?? 0,
      helper: "Auto-save",
      tone: "green",
    }));
}

export default function Paybill() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [businessNumber, setBusinessNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const activityQuery = useActivityQuery();
  const profileQuery = useProfileQuery();
  const walletQuery = useWalletQuery();
  const paybillMutation = usePaybillMutation();

  useEffect(() => {
    const queryError = activityQuery.error || profileQuery.error || walletQuery.error;
    if (!queryError) return;

    if (queryError.response?.status === 401 || queryError.response?.status === 403) {
      navigate("/login", { replace: true });
      return;
    }

    setFeedback({
      type: "error",
      message: queryError.response?.data?.message || queryError.message || "We could not load this paybill flow.",
    });
  }, [activityQuery.error, navigate, profileQuery.error, walletQuery.error]);

  const activity = useMemo(() => sortActivityByNewest(activityQuery.data || []), [activityQuery.data]);
  const user = profileQuery.data;
  const isLoading = activityQuery.isLoading || profileQuery.isLoading || walletQuery.isLoading;

  async function submitPaybill(payload) {
    setIsSubmitting(true);
    try {
      const payment = await paybillMutation.mutateAsync(payload);
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

      await Promise.all([activityQuery.refetch(), profileQuery.refetch(), walletQuery.refetch()]);
      triggerDashboardRefresh();
      return payment;
    } finally {
      setIsSubmitting(false);
    }
  }

  const numericAmount = toAmount(amount);
  const roundUpRule = Number(user?.roundUpRule || 50);
  const roundUp = useMemo(() => getRoundUp(numericAmount, roundUpRule), [numericAmount, roundUpRule]);
  const cleanBusinessNumber = businessNumber.trim();
  const cleanAccountNumber = accountNumber.trim();
  const canConfirm = numericAmount > 0 && cleanBusinessNumber && cleanAccountNumber && !isSubmitting;
  const recentRows = useMemo(() => buildPaybillRows(activity), [activity]);
  const pageFeedback = feedback;

  async function handleConfirm(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!numericAmount || !cleanBusinessNumber || !cleanAccountNumber) {
      setFeedback({ type: "error", message: "Enter a business number, account number, and amount before confirming." });
      return;
    }

    setFeedback(null);

    try {
      const result = await submitPaybill({
        amount: numericAmount,
        merchant: `Paybill ${cleanBusinessNumber}`,
        description: note.trim() || `Paybill ${cleanBusinessNumber} account ${cleanAccountNumber}`,
        transactionType: "bill",
        businessNumber: cleanBusinessNumber,
        accountNumber: cleanAccountNumber,
        mode: "paybill",
      });

      setAmount("");
      setBusinessNumber("");
      setAccountNumber("");
      setNote("");
      setSubmitted(false);
      setFeedback({
        type: "success",
        message: isConfirmedSavingsStatus(result?.status)
          ? "Paybill confirmed and round-up saved."
          : "Paybill request sent. Savings will update after confirmation.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete this paybill payment.",
      });
    }
  }

  return (
    <ServicePageShell
      current="Paybill"
      feedback={pageFeedback}
      trail={[
        { label: "Payments", path: "/payments" },
        { label: "Lipa na M-Pesa" },
        { label: "Paybill" },
      ]}
    >
      {isLoading ? (
        <section className="service-loading-card">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading paybill flow...</span>
        </section>
      ) : (
        <>
          <form className="service-layout-grid" onSubmit={handleConfirm}>
            <ServiceFormCard
              label="Wallet service"
              title={["Paybill", "Payment"]}
              badge="Auto round-up on"
              subtitle="Pay a business number and let AirSave save the round-up automatically."
            >
              <label className="service-field">
                <span>Business Number</span>
                <input
                  className={submitted && !cleanBusinessNumber ? "service-dark-input service-input-error" : "service-dark-input"}
                  value={businessNumber}
                  onChange={(event) => setBusinessNumber(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Enter business number"
                  inputMode="numeric"
                />
              </label>

              <label className="service-field">
                <span>Account Number</span>
                <input
                  className={submitted && !cleanAccountNumber ? "service-dark-input service-input-error" : "service-dark-input"}
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value.replace(/[^\w-]/g, "").slice(0, 32))}
                  placeholder="Enter account number"
                  inputMode="text"
                />
              </label>

              <AmountInput
                value={amount}
                onChange={setAmount}
                error={submitted && !numericAmount}
              />

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

            <TransactionPreview
              totalLabel="Wallet Charged"
              totalAmount={roundUp.rounded}
              rows={[
                { label: "Business number", value: cleanBusinessNumber || "Not set" },
                { label: "Account number", value: cleanAccountNumber || "Not set" },
                { label: "Amount", value: formatKsh(numericAmount) },
                { label: "Round-up rule", value: `Nearest ${roundUpRule}` },
                { label: "Auto-saved", value: formatKsh(roundUp.savings), tone: "success" },
              ]}
            >
              <button className="service-primary-action" type="submit" disabled={!canConfirm}>
                {isSubmitting ? "Confirming..." : "Confirm Payment"}
              </button>
              <button className="service-secondary-action" type="button" onClick={() => navigate("/payments")}>
                Cancel
              </button>
            </TransactionPreview>
          </form>

          <RecentServiceActivity
            title="Paybill savings"
            items={recentRows}
            emptyMessage="No paybill savings yet."
          />
        </>
      )}
    </ServicePageShell>
  );
}
