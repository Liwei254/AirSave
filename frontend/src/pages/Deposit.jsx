import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AmountInput,
  PhoneInput,
  RecentServiceActivity,
  ServiceFormCard,
  ServicePageShell,
  TransactionPreview,
} from "../components/ServicePageComponents.jsx";
import {
  depositWallet,
  getCurrentUser,
  getSavingsActivity,
  getWallet,
} from "../services/api";
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
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [activity, setActivity] = useState([]);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPage = useCallback(async () => {
    try {
      const [userData, walletData, activityData] = await Promise.all([
        getCurrentUser(),
        getWallet(),
        getSavingsActivity(),
      ]);

      setUser(userData);
      setWallet(walletData);
      setActivity(sortActivityByNewest(activityData || []));
      setFeedback(null);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate("/login", { replace: true });
        return;
      }

      setFeedback({ type: "error", message: error.message || "We could not load deposit details." });
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (user?.phone) {
      setPhone(extractKenyaPhoneDigits(user.phone));
    }
  }, [user?.phone]);

  const numericAmount = toAmount(amount);
  const validPhone = isValidKenyaPhoneDigits(phone);
  const phoneDisplay = getFullKenyaPhone(phone) || "Not set";
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

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const result = await depositWallet({
        amount: numericAmount,
        phoneNumber: phoneDisplay,
        sourceMethod: "M-Pesa",
      });

      setWallet((current) => ({ ...(current || {}), balance: result.balance ?? newBalance }));
      setAmount("");
      setSubmitted(false);
      await loadPage();
      triggerDashboardRefresh();
      setFeedback({ type: "success", message: result.message || "Deposit confirmed successfully." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete this deposit.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ServicePageShell current="Deposit" feedback={feedback}>
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
                value={phone}
                onChange={setPhone}
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
