import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AmountInput,
  RecentServiceActivity,
  ServiceFormCard,
  ServicePageShell,
  TransactionPreview,
} from "../components/ServicePageComponents.jsx";
import { getCurrentUser, getPaymentStatus, getSavingsActivity, getWallet, initiatePayment } from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { formatServiceDate, getRoundUp, toAmount } from "../utils/servicePage";
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

function buildRoundUpRows(activity) {
  return (activity || [])
    .filter((item) => {
      const transactionType = String(item.transactionType || "purchase").toLowerCase();
      return transactionType !== "send" && item.type !== "withdraw";
    })
    .slice(0, 5)
    .map((item) => {
      const title = item.goalName || item.merchant || "Savings wallet";
      const status = getStatusText(item.status);

      return {
        id: item._id || item.reference,
        title,
        meta: `${formatServiceDate(item.date || item.createdAt)} - ${status}`,
        amount: item.savings ?? item.savingsAmount ?? 0,
        helper: "Auto-save",
        tone: String(title).toLowerCase().includes("vacation") ? "gold" : "green",
      };
    });
}

export default function LipaNaAirSave() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [tillNumber, setTillNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const loadPage = useCallback(async () => {
    try {
      const [activityData, , userData] = await Promise.all([
        getSavingsActivity(),
        getWallet(),
        getCurrentUser(),
      ]);

      setActivity(sortActivityByNewest(activityData || []));
      setUser(userData);
      setLoadError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/");
        return;
      }
      setLoadError(err.response?.data?.message || err.message || "We could not load this payment flow.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function submitPurchase(payload) {
    setIsSubmitting(true);
    try {
      const payment = await initiatePayment(payload);
      const paymentReference = payment.paymentReference || payment.reference;

      if (paymentReference) {
        for (let attempt = 0; attempt < paymentPollAttempts; attempt += 1) {
          await wait(paymentPollDelayMs);
          const statusResult = await getPaymentStatus(paymentReference);
          const normalizedStatus = String(statusResult.status || "").toLowerCase();

          if (terminalPaymentStatuses.includes(normalizedStatus)) {
            payment.status = statusResult.status;
            break;
          }
        }
      }

      await loadPage();
      triggerDashboardRefresh();
      return payment;
    } finally {
      setIsSubmitting(false);
    }
  }

  const numericAmount = toAmount(amount);
  const roundUpRule = Number(user?.roundUpRule || 50);
  const roundUp = useMemo(() => getRoundUp(numericAmount, roundUpRule), [numericAmount, roundUpRule]);
  const canConfirm = numericAmount > 0 && Boolean(tillNumber.trim()) && !isSubmitting;
  const recentRows = useMemo(() => buildRoundUpRows(activity), [activity]);
  const pageFeedback = feedback || (loadError ? { type: "error", message: loadError } : null);

  async function handleConfirm(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!numericAmount || !tillNumber.trim()) {
      setFeedback({ type: "error", message: "Enter a valid till number and amount before confirming." });
      return;
    }

    setFeedback(null);

    try {
      const result = await submitPurchase({
        amount: numericAmount,
        merchant: `Till ${tillNumber.trim()}`,
        description: note.trim() || `Till ${tillNumber.trim()}`,
        transactionType: "purchase",
        mode: "wallet-purchase",
      });

      setAmount("");
      setTillNumber("");
      setNote("");
      setSubmitted(false);
      setFeedback({
        type: "success",
        message: isConfirmedSavingsStatus(result?.status)
          ? "Purchase confirmed and round-up saved."
          : "Purchase request sent. Savings will update after confirmation.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete this purchase.",
      });
    }
  }

  return (
    <ServicePageShell current="Buy Goods" feedback={pageFeedback}>
      {isLoading ? (
        <section className="service-loading-card">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading payment flow...</span>
        </section>
      ) : (
        <>
          <form className="service-layout-grid" onSubmit={handleConfirm}>
            <ServiceFormCard
              label="Wallet service"
              title={["Lipa na", "AirSave"]}
              badge="Auto round-up on"
              subtitle="Pay a till and let AirSave save the round-up automatically."
            >
              <label className="service-field">
                <span>Till Number</span>
                <input
                  className={submitted && !tillNumber.trim() ? "service-dark-input service-input-error" : "service-dark-input"}
                  value={tillNumber}
                  onChange={(event) => setTillNumber(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Enter till number"
                  inputMode="numeric"
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
                { label: "Till number", value: tillNumber || "Not set" },
                { label: "Amount", value: numericAmount ? `Ksh ${numericAmount.toLocaleString("en-KE")}` : "Ksh 0" },
                { label: "Round-up rule", value: `Nearest ${roundUpRule}` },
                { label: "Auto-saved", value: `Ksh ${roundUp.savings.toLocaleString("en-KE")}`, tone: "success" },
              ]}
            >
              <button className="service-primary-action" type="submit" disabled={!canConfirm}>
                {isSubmitting ? "Confirming..." : "Confirm Purchase"}
              </button>
              <button className="service-secondary-action" type="button" onClick={() => navigate("/settings")}>
                Edit round-up rule
              </button>
              <button className="service-secondary-action" type="button" onClick={() => navigate("/dashboard")}>
                Cancel
              </button>
            </TransactionPreview>
          </form>

          <RecentServiceActivity
            title="Round-up savings"
            items={recentRows}
            emptyMessage="No round-up savings yet."
          />
        </>
      )}
    </ServicePageShell>
  );
}
