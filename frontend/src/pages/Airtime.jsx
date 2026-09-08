import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityQuery, useActiveGoalQuery, useProfileQuery, useWalletQuery } from "../api/hooks";
import { buyAirtime, fetchPaymentStatus } from "../api/paymentsApi";
import Layout from "../components/Layout.jsx";
import { formatCurrency } from "../utils/formatters";
import { getRoundUp, toAmount } from "../utils/servicePage";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `AIRTIME-${crypto.randomUUID()}`;
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
function wait(delay) { return new Promise((resolve) => window.setTimeout(resolve, delay)); }

export default function Airtime() {
  const navigate = useNavigate();
  const profileQuery = useProfileQuery();
  const walletQuery = useWalletQuery();
  const activeGoalQuery = useActiveGoalQuery();
  const activityQuery = useActivityQuery();
  const [operator, setOperator] = useState("safaricom");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const user = profileQuery.data;
  const goal = activeGoalQuery.data;
  const walletBalance = Number(walletQuery.data?.balance ?? walletQuery.data?.availableBalance ?? 0);
  const numericAmount = toAmount(amount);
  const rule = Number(user?.roundUpRule || 50);
  const roundUp = useMemo(() => getRoundUp(numericAmount, rule), [numericAmount, rule]);
  const total = roundUp.rounded;
  const canSubmit = Boolean(phone.trim()) && numericAmount > 0 && total <= walletBalance && !submitting;
  const isLoading = profileQuery.isLoading || walletQuery.isLoading || activeGoalQuery.isLoading;

  async function submit(event) {
    event.preventDefault();
    setSubmitted(true);
    if (!phone.trim() || !numericAmount) { setFeedback({ type: "error", message: "Enter a phone number and airtime amount." }); return; }
    if (total > walletBalance) { setFeedback({ type: "error", message: "Insufficient wallet balance. Deposit funds before buying airtime." }); return; }
    setFeedback(null);
    setSubmitting(true);
    try {
      const selectedOperator = operators.find((item) => item.value === operator)?.label || "Mobile";
      const result = await buyAirtime({
        amount: numericAmount,
        phone: phone.trim(),
        operator,
        merchant: `${selectedOperator} Airtime`,
        description: `${selectedOperator} airtime purchase`,
        goalId: goal?._id || goal?.id || null,
        idempotencyKey: createIdempotencyKey(),
      });
      const reference = result.paymentReference || result.reference;
      if (reference) {
        for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
          await wait(pollDelayMs);
          const statusResult = await fetchPaymentStatus(reference);
          if (terminalStatuses.includes(String(statusResult.status || "").toLowerCase())) break;
        }
      }
      await Promise.all([profileQuery.refetch(), walletQuery.refetch(), activeGoalQuery.refetch(), activityQuery.refetch()]);
      setAmount("");
      setPhone("");
      setSubmitted(false);
      const destination = goal?.name || "your AirSave savings balance";
      setFeedback({ type: "success", message: roundUp.savings > 0 ? `Airtime purchase confirmed. ${formatCurrency(roundUp.savings)} was automatically saved to ${destination}.` : "Airtime purchase confirmed." });
    } catch (error) {
      setFeedback({ type: "error", message: error.response?.data?.message || error.message || "We could not complete the airtime purchase." });
    } finally { setSubmitting(false); }
  }

  if (isLoading) return <Layout><main className="service-page-shell"><section className="service-loading-card"><span className="spinner spinner-dark" aria-hidden="true" /><span>Loading airtime savings flow...</span></section></main></Layout>;

  return <Layout>
    <main className="service-page-shell">
      <div className="service-breadcrumb">Payments <span>/</span> Airtime</div>
      {feedback ? <div className={`feedback feedback-${feedback.type}`} role="status">{feedback.message}</div> : null}
      <form className="service-layout-grid" onSubmit={submit}>
        <section className="service-form-card">
          <div className="service-form-heading"><div><span className="service-kicker">AirSave savings</span><h1><span>Buy</span> <span>Airtime</span></h1></div><span className="service-badge">Round-up on</span></div>
          <p className="service-form-subtitle">Buy airtime as usual. AirSave rounds up the purchase and automatically saves the difference.</p>
          <label className="service-field"><span>Network</span><select className="service-dark-input" value={operator} onChange={(event) => setOperator(event.target.value)}>{operators.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="service-field"><span>Phone number</span><input className={submitted && !phone.trim() ? "service-dark-input service-input-error" : "service-dark-input"} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Enter phone number" inputMode="tel" /></label>
          <label className="service-field"><span>Airtime amount</span><div className={submitted && !numericAmount ? "service-amount-input service-input-error" : "service-amount-input"}><span>KES</span><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} placeholder="100" inputMode="decimal" /></div></label>
          <div className="service-readonly-value">Savings destination: {goal?.name || "AirSave savings balance"}</div>
        </section>
        <section className="service-preview-card">
          <div className="service-preview-heading"><span>Total wallet debit</span><strong>{formatCurrency(total || numericAmount)}</strong></div>
          <dl className="service-preview-rows">
            <div><dt>Airtime</dt><dd>{formatCurrency(numericAmount)}</dd></div>
            <div><dt>Round-up rule</dt><dd>Nearest {rule}</dd></div>
            <div><dt>Auto-saved</dt><dd className="service-success-text">{formatCurrency(roundUp.savings)}</dd></div>
            <div><dt>Saving to</dt><dd>{goal?.name || "AirSave savings balance"}</dd></div>
            <div><dt>Wallet balance</dt><dd>{formatCurrency(walletBalance)}</dd></div>
            <div><dt>After purchase</dt><dd>{formatCurrency(Math.max(0, walletBalance - total))}</dd></div>
          </dl>
          <button className="service-primary-action" type="submit" disabled={!canSubmit}>{submitting ? "Processing..." : "Buy Airtime & Save"}</button>
          <button className="service-secondary-action" type="button" onClick={() => navigate("/settings")} disabled={submitting}>Change round-up rule</button>
          {!walletBalance ? <button className="service-secondary-action" type="button" onClick={() => navigate("/deposit")} disabled={submitting}>Deposit funds</button> : null}
        </section>
      </form>
      <section className="service-recent-card"><div><span className="service-kicker">Activity</span><h2>Recent airtime purchases</h2></div><p>Confirmed airtime purchases and their round-up savings appear in Activity.</p>{(activityQuery.data || []).filter((item) => String(item.transactionType || item.type || "").toLowerCase() === "airtime").slice(0, 5).map((item) => <div className="service-recent-row" key={item._id || item.reference}><span>{item.merchant || "Airtime"}</span><strong>{formatCurrency(item.amount || 0)}</strong></div>)}</section>
    </main>
  </Layout>;
}
