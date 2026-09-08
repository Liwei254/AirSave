import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityQuery, useProfileQuery, useWalletQuery } from "../api/hooks";
import { initiatePayment } from "../services/api";
import { fetchPaymentStatus } from "../api/paymentsApi";
import Layout from "../components/Layout.jsx";
import { formatCurrency } from "../utils/formatters";
import { getRoundUp, toAmount } from "../utils/servicePage";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `AIRTIME-${crypto.randomUUID()}`;
  }
  return `AIRTIME-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const operators = [
  { value: "safaricom", label: "Safaricom" },
  { value: "airtel", label: "Airtel" },
  { value: "telkom", label: "Telkom" },
];

const pollDelayMs = 1000;
const pollAttempts = 7;
const terminalStatuses = ["confirmed", "completed", "success", "successful", "failed"];

function wait(delay) {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

export default function Airtime() {
  const navigate = useNavigate();
  const profileQuery = useProfileQuery();
  const walletQuery = useWalletQuery();
  const activityQuery = useActivityQuery();
  const [operator, setOperator] = useState("safaricom");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const user = profileQuery.data;
  const walletBalance = Number(walletQuery.data?.balance ?? walletQuery.data?.availableBalance ?? 0);
  const numericAmount = toAmount(amount);
  const rule = Number(user?.roundUpRule || 50);
  const roundUp = useMemo(() => getRoundUp(numericAmount, rule), [numericAmount, rule]);
  const total = roundUp.rounded;
  const activeGoal = user?.activeGoal || null;
  const canSubmit = Boolean(phone.trim()) && numericAmount > 0 && total <= walletBalance && !submitting;

  async function submit(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!phone.trim() || !numericAmount) {
      setFeedback({ type: "error", message: "Enter a phone number and airtime amount." });
      return;
    }

    if (total > walletBalance) {
      setFeedback({ type: "error", message: "Insufficient wallet balance for the airtime purchase and round-up." });
      return;
    }

    setFeedback(null);
    setSubmitting(true);

    try {
      const result = await initiatePayment({
        amount: numericAmount,
        phone: phone.trim(),
        transactionType: "airtime",
        purchaseType: "airtime",
        operator,
        merchant: `${operators.find((item) => item.value === operator)?.label || "Mobile"} Airtime`,
        description: `${operators.find((item) => item.value === operator)?.label || "Mobile"} airtime purchase`,
        goalId: activeGoal?.id || activeGoal?._id || null,
        idempotencyKey: createIdempotencyKey(),
      });

      const reference = result.paymentReference || result.reference;
      if (reference) {
        for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
          await wait(pollDelayMs);
          const statusResult = await fetchPaymentStatus(reference);
          const status = String(statusResult.status || "").toLowerCase();
          if (terminalStatuses.includes(status)) break;
        }
      }

      await Promise.all([profileQuery.refetch(), walletQuery.refetch(), activityQuery.refetch()]);
      setAmount("");
      setPhone("");
      setSubmitted(false);
      setFeedback({
        type: "success",
        message: roundUp.savings > 0
          ? `Airtime purchase confirmed. ${formatCurrency(roundUp.savings)} has been saved automatically.`
          : "Airtime purchase confirmed.",
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

  return (
    <Layout>
      <main className="service-page-shell">
        <div className="service-breadcrumb">Payments <span>/</span> Airtime</div>
        {feedback ? <div className={`feedback feedback-${feedback.type}`} role="status">{feedback.message}</div> : null}

        <form className="service-layout-grid" onSubmit={submit}>
          <section className="service-form-card">
            <div className="service-form-heading">
              <div>
                <span className="service-kicker">Airtime service</span>
                <h1><span>Buy</span> <span>Airtime</span></h1>
              </div>
              <span className="service-badge">Round-up on</span>
            </div>
            <p className="service-form-subtitle">Buy airtime normally. AirSave adds the difference to your savings automatically.</p>

            <label className="service-field">
              <span>Network</span>
              <select className="service-dark-input" value={operator} onChange={(event) => setOperator(event.target.value)}>
                {operators.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <label className="service-field">
              <span>Phone number</span>
              <input
                className={submitted && !phone.trim() ? "service-dark-input service-input-error" : "service-dark-input"}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter phone number"
                inputMode="tel"
              />
            </label>

            <label className="service-field">
              <span>Airtime amount</span>
              <div className={submitted && !numericAmount ? "service-amount-input service-input-error" : "service-amount-input"}>
                <span>KES</span>
                <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} placeholder="100" inputMode="decimal" />
              </div>
            </label>
          </section>

          <section className="service-preview-card">
            <div className="service-preview-heading"><span>Purchase summary</span><strong>{formatCurrency(total || numericAmount)}</strong></div>
            <dl className="service-preview-rows">
              <div><dt>Airtime</dt><dd>{formatCurrency(numericAmount)}</dd></div>
              <div><dt>Round-up rule</dt><dd>Nearest {rule}</dd></div>
              <div><dt>Auto-saved</dt><dd className="service-success-text">{formatCurrency(roundUp.savings)}</dd></div>
              <div><dt>Wallet balance</dt><dd>{formatCurrency(walletBalance)}</dd></div>
              <div><dt>After purchase</dt><dd>{formatCurrency(Math.max(0, walletBalance - total))}</dd></div>
              <div><dt>Savings goal</dt><dd>{activeGoal?.name || "Savings wallet"}</dd></div>
            </dl>
            <button className="service-primary-action" type="submit" disabled={!canSubmit}>
              {submitting ? "Processing..." : "Buy Airtime & Save"}
            </button>
            <button className="service-secondary-action" type="button" onClick={() => navigate("/settings")} disabled={submitting}>
              Change round-up rule
            </button>
          </section>
        </form>

        <section className="service-recent-card">
          <div><span className="service-kicker">Activity</span><h2>Recent airtime purchases</h2></div>
          <p>Every confirmed airtime purchase and its round-up savings will appear in Activity.</p>
          {(activityQuery.data || []).filter((item) => String(item.transactionType || item.type || "").toLowerCase() === "airtime").slice(0, 5).map((item) => (
            <div className="service-recent-row" key={item._id || item.reference}>
              <span>{item.merchant || "Airtime"}</span>
              <strong>{formatCurrency(item.amount || 0)}</strong>
            </div>
          ))}
        </section>
      </main>
    </Layout>
  );
}
