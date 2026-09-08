import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityQuery, useActiveGoalQuery, useProfileQuery, useWalletQuery } from "../api/hooks";
import { buyAirtime, fetchPaymentStatus } from "../api/paymentsApi";
import {
  AmountInput,
  PhoneInput,
  RecentServiceActivity,
  ServiceFormCard,
  ServicePageShell,
  TransactionPreview,
} from "../components/ServicePageComponents.jsx";
import { formatServiceDate, getFullKenyaPhone, extractKenyaPhoneDigits, isValidKenyaPhoneDigits, toAmount } from "../utils/servicePage";
import { getRoundUp } from "../utils/servicePage";
import { formatCurrency } from "../utils/formatters";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `AIRTIME-${crypto.randomUUID()}`;
  return `AIRTIME-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const operators = [
  { value: "safaricom", label: "Safaricom" },
  { value: "airtel", label: "Airtel" },
  { value: "telkom", label: "Telkom" },
];
const terminalStatuses = ["confirmed", "completed", "success", "successful", "failed"];

function wait(delay) {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function buildRecentRows(activity) {
  return (activity || [])
    .filter((item) => String(item.transactionType || item.type || "").toLowerCase() === "airtime")
    .slice(0, 5)
    .map((item) => ({
      id: item._id || item.reference,
      title: item.merchant || "Airtime purchase",
      meta: `${formatServiceDate(item.date || item.createdAt)} - ${String(item.status || "confirmed").toLowerCase()}`,
      amount: item.savingsAmount ?? item.savings ?? 0,
      helper: "Auto-save",
      tone: "green",
    }));
}

export default function Airtime() {
  const navigate = useNavigate();
  const profileQuery = useProfileQuery();
  const walletQuery = useWalletQuery();
  const activeGoalQuery = useActiveGoalQuery();
  const activityQuery = useActivityQuery();

  const [operator, setOperator] = useState("safaricom");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const user = profileQuery.data;
  const goal = activeGoalQuery.data;
  const walletBalance = Number(walletQuery.data?.balance ?? walletQuery.data?.availableBalance ?? 0);
  const numericAmount = toAmount(amount);
  const roundUpRule = Number(user?.roundUpRule || 50);
  const roundUp = useMemo(() => getRoundUp(numericAmount, roundUpRule), [numericAmount, roundUpRule]);
  const totalWalletDebit = roundUp.rounded;
  const effectivePhone = phoneTouched ? phone : extractKenyaPhoneDigits(user?.phone || "");
  const validPhone = isValidKenyaPhoneDigits(effectivePhone);
  const phoneDisplay = getFullKenyaPhone(effectivePhone) || "Not set";
  const savingDestination = goal?.name || "AirSave savings balance";
  const afterPurchase = Math.max(0, walletBalance - totalWalletDebit);
  const canSubmit = numericAmount > 0 && validPhone && totalWalletDebit <= walletBalance && !submitting;
  const isLoading = profileQuery.isLoading || walletQuery.isLoading || activeGoalQuery.isLoading || activityQuery.isLoading;
  const recentRows = useMemo(() => buildRecentRows(activityQuery.data), [activityQuery.data]);

  async function submit(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!numericAmount || !validPhone) {
      setFeedback({ type: "error", message: "Enter a valid airtime amount and phone number." });
      return;
    }

    if (totalWalletDebit > walletBalance) {
      setFeedback({ type: "error", message: "Insufficient wallet balance. Deposit funds before buying airtime." });
      return;
    }

    setFeedback(null);
    setSubmitting(true);

    try {
      const selectedOperator = operators.find((item) => item.value === operator)?.label || "Mobile";
      const result = await buyAirtime({
        amount: numericAmount,
        phone: phoneDisplay,
        operator,
        description: `${selectedOperator} airtime purchase`,
        goalId: goal?._id || goal?.id || null,
        idempotencyKey: createIdempotencyKey(),
      });

      const reference = result.paymentReference || result.reference;
      if (reference) {
        for (let attempt = 0; attempt < 7; attempt += 1) {
          await wait(1000);
          const statusResult = await fetchPaymentStatus(reference);
          if (terminalStatuses.includes(String(statusResult.status || "").toLowerCase())) break;
        }
      }

      await Promise.all([
        profileQuery.refetch(),
        walletQuery.refetch(),
        activeGoalQuery.refetch(),
        activityQuery.refetch(),
      ]);

      setAmount("");
      setPhone("");
      setPhoneTouched(false);
      setSubmitted(false);
      setFeedback({
        type: "success",
        message:
          Number(result.savingsAmount || roundUp.savings) > 0
            ? `Airtime purchased. ${formatCurrency(Number(result.savingsAmount || roundUp.savings))} was automatically saved${goal ? ` to ${goal.name}` : ""}.`
            : "Airtime purchased successfully.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete the airtime purchase.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <ServicePageShell current="Airtime">
        <section className="service-loading-card">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading airtime savings flow...</span>
        </section>
      </ServicePageShell>
    );
  }

  return (
    <ServicePageShell
      current="Airtime"
      feedback={feedback}
      trail={[{ label: "Payments", path: "/payments" }, { label: "Airtime" }]}
    >
      <section className="airtime-hero-card" aria-labelledby="airtime-title">
        <div>
          <span className="airtime-eyebrow">AirSave savings engine</span>
          <h1 id="airtime-title">Buy airtime. Save the difference.</h1>
          <p>Choose your network, enter your airtime amount, and AirSave automatically moves the round-up into your savings.</p>
        </div>
        <div className="airtime-rule-card">
          <span>Current round-up</span>
          <strong>Nearest KES {roundUpRule}</strong>
          <button type="button" onClick={() => navigate("/settings")} disabled={submitting}>Change rule</button>
        </div>
      </section>

      <form className="service-layout-grid airtime-flow-grid" onSubmit={submit}>
        <ServiceFormCard
          label="Airtime purchase"
          title={["Buy", "Airtime"]}
          badge="Automatic savings"
          subtitle="The airtime amount stays the same. AirSave uses the extra round-up amount as your savings contribution."
        >
          <label className="service-field">
            <span>Mobile network</span>
            <select className="service-dark-input airtime-select" value={operator} onChange={(event) => setOperator(event.target.value)} disabled={submitting}>
              {operators.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <PhoneInput
            label="Phone number"
            value={effectivePhone}
            onChange={(value) => {
              setPhone(value);
              setPhoneTouched(true);
            }}
            error={submitted && !validPhone}
            placeholder="712 345 678"
          />

          <AmountInput
            label="Airtime amount"
            value={amount}
            onChange={setAmount}
            placeholder="100"
            error={submitted && !numericAmount}
            disabled={submitting}
          />

          <div className="airtime-destination-card">
            <span>Automatic savings destination</span>
            <strong>{savingDestination}</strong>
            <small>{goal ? "Your active goal receives the round-up." : "Round-ups stay in your AirSave savings balance until you create a goal."}</small>
          </div>
        </ServiceFormCard>

        <TransactionPreview
          totalLabel="Wallet charged"
          totalAmount={totalWalletDebit || numericAmount}
          rows={[
            { label: "Airtime", value: formatCurrency(numericAmount) },
            { label: `Round-up · nearest ${roundUpRule}`, value: formatCurrency(roundUp.savings), tone: "success" },
            { label: "Saving to", value: savingDestination },
            { label: "Wallet balance", value: formatCurrency(walletBalance) },
            { label: "After purchase", value: formatCurrency(afterPurchase), tone: "success" },
            { label: "Phone", value: phoneDisplay },
          ]}
        >
          <button className="service-primary-action airtime-primary-action" type="submit" disabled={!canSubmit}>
            {submitting ? "Processing airtime..." : "Buy Airtime & Save"}
          </button>
          <button className="service-secondary-action" type="button" onClick={() => navigate("/settings")} disabled={submitting}>
            Adjust round-up rule
          </button>
          {walletBalance <= 0 ? (
            <button className="service-secondary-action" type="button" onClick={() => navigate("/deposit")} disabled={submitting}>
              Deposit funds
            </button>
          ) : null}
        </TransactionPreview>
      </form>

      <RecentServiceActivity title="Recent airtime savings" items={recentRows} emptyMessage="No airtime purchases yet. Buy your first airtime package and start saving automatically." />
    </ServicePageShell>
  );
}
