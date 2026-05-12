import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useActivityQuery,
  useDepositMutation,
  useProfileQuery,
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
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import {
  extractKenyaPhoneDigits,
  formatKsh,
  formatServiceDate,
  getFullKenyaPhone,
  isValidKenyaPhoneDigits,
  toAmount,
} from "../utils/servicePage";
import { sortActivityByNewest } from "../utils/savings";

function getStatusText(status) {
  return String(status || "confirmed").toLowerCase();
}

function buildDepositRows(activity) {
  return (activity || [])
    .filter((item) => {
      const transactionType = String(item.transactionType || "").toLowerCase();
      const merchant = String(item.merchant || item.description || "").toLowerCase();
      return transactionType === "deposit" || merchant.includes("wallet deposit");
    })
    .slice(0, 5)
    .map((item) => ({
      id: item._id || item.reference,
      title: item.merchant || "Wallet deposit",
      meta: `${formatServiceDate(item.date || item.createdAt)} - ${getStatusText(item.status)}`,
      amount: item.amount ?? item.savings ?? item.originalAmount ?? 0,
      helper: "M-Pesa",
      tone: "green",
    }));
}

export default function Deposit() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const profileQuery = useProfileQuery();
  const walletQuery = useWalletQuery();
  const activityQuery = useActivityQuery();
  const depositMutation = useDepositMutation();
  const loadError = profileQuery.error || walletQuery.error || activityQuery.error;

  useEffect(() => {
    if (!loadError) return;

    if (loadError.response?.status === 401 || loadError.response?.status === 403) {
      navigate("/login", { replace: true });
    }
  }, [loadError, navigate]);

  const user = profileQuery.data;
  const wallet = walletQuery.data;
  const activity = useMemo(() => sortActivityByNewest(activityQuery.data || []), [activityQuery.data]);
  const isLoading = profileQuery.isLoading || walletQuery.isLoading || activityQuery.isLoading;
  const isSubmitting = depositMutation.isPending;
  const loadFeedback =
    loadError && loadError.response?.status !== 401 && loadError.response?.status !== 403
      ? { type: "error", message: loadError.message || "We could not load deposit details." }
      : null;

  const numericAmount = toAmount(amount);
  const effectivePhone = phoneTouched ? phone : extractKenyaPhoneDigits(user?.phone || "");
  const validPhone = isValidKenyaPhoneDigits(effectivePhone);
  const phoneDisplay = getFullKenyaPhone(effectivePhone) || "Not set";
  const walletBalance = Number(wallet?.balance || 0);
  const newBalance = walletBalance + numericAmount;
  const canConfirm = numericAmount > 0 && validPhone && !isSubmitting;
  const recentRows = useMemo(() => buildDepositRows(activity), [activity]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!numericAmount || !validPhone) {
      setFeedback({ type: "error", message: "Enter a valid amount and M-Pesa phone number." });
      return;
    }

    setFeedback(null);

    try {
      const result = await depositMutation.mutateAsync({
        amount: numericAmount,
        phoneNumber: phoneDisplay,
        sourceMethod: "M-Pesa",
      });

      setAmount("");
      setSubmitted(false);
      triggerDashboardRefresh();
      setFeedback({ type: "success", message: result.message || "Deposit confirmed successfully." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete this deposit.",
      });
    }
  }

  return (
    <ServicePageShell current="Deposit" feedback={feedback || loadFeedback}>
      {isLoading ? (
        <section className="service-loading-card">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading deposit flow...</span>
        </section>
      ) : (
        <>
          <form className="service-layout-grid" onSubmit={handleSubmit}>
            <ServiceFormCard
              label="Wallet service"
              title={["Deposit", "Funds"]}
              badge="M-Pesa ready"
              subtitle="Add money to your AirSave wallet before sending, paying, or withdrawing."
            >
              <label className="service-field">
                <span>Source Method</span>
                <input className="service-dark-input" value="M-Pesa" readOnly />
              </label>

              <PhoneInput
                label="Phone Number"
                value={effectivePhone}
                onChange={(value) => {
                  setPhone(value);
                  setPhoneTouched(true);
                }}
                error={submitted && !validPhone}
              />

              <AmountInput
                value={amount}
                onChange={setAmount}
                error={submitted && !numericAmount}
              />
            </ServiceFormCard>

            <TransactionPreview
              totalLabel="Deposit Amount"
              totalAmount={numericAmount}
              rows={[
                { label: "Source", value: "M-Pesa" },
                { label: "Phone", value: phoneDisplay },
                { label: "Fee", value: formatKsh(0) },
                { label: "Wallet balance", value: formatKsh(walletBalance) },
                { label: "New balance", value: formatKsh(newBalance), tone: "success" },
              ]}
            >
              <button className="service-primary-action" type="submit" disabled={!canConfirm}>
                {isSubmitting ? "Confirming..." : "Confirm Deposit"}
              </button>
              <button className="service-secondary-action" type="button" onClick={() => navigate("/payments")}>
                Cancel
              </button>
            </TransactionPreview>
          </form>

          <RecentServiceActivity
            title="Recent deposits"
            items={recentRows}
            emptyMessage="No wallet deposits yet."
          />
        </>
      )}
    </ServicePageShell>
  );
}
