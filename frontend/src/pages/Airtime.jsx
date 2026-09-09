import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveGoalQuery, useActivityQuery, useBuyAirtimeMutation, useProfileQuery } from "../api/hooks";
import { AmountInput, PhoneInput, RecentServiceActivity, ServiceFormCard, ServicePageShell, TransactionPreview } from "../components/ServicePageComponents.jsx";
import { extractKenyaPhoneDigits, formatKsh, getRoundUp, toAmount } from "../utils/servicePage";

function activityRows(activity) {
  return (activity || []).filter((item) => item.transactionType === "airtime" || item.type === "airtime").slice(0, 5).map((item) => ({ id: item.id || item._id, title: "Airtime purchase", meta: item.phone || item.date || "Airtime", amount: item.amount || item.purchaseAmount || 0, helper: item.savingsAmount ? `Saved ${formatKsh(item.savingsAmount)}` : item.status, tone: "gold" }));
}

export default function Airtime() {
  const navigate = useNavigate();
  const profileQuery = useProfileQuery();
  const goalQuery = useActiveGoalQuery();
  const activityQuery = useActivityQuery();
  const purchaseMutation = useBuyAirtimeMutation();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [feedback, setFeedback] = useState(null);
  const user = profileQuery.data;
  const activeGoal = goalQuery.data;
  const numericAmount = toAmount(amount);
  const roundUpRule = Number(user?.roundUpRule || 50);
  const roundUp = useMemo(() => getRoundUp(numericAmount, roundUpRule), [numericAmount, roundUpRule]);
  const recipient = phone || extractKenyaPhoneDigits(user?.phone || "");
  const goalRequired = roundUp.savings > 0 && !activeGoal;
  const canSubmit = numericAmount > 0 && recipient && !goalRequired && !purchaseMutation.isPending;
  const loadError = profileQuery.error || goalQuery.error || activityQuery.error;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) { setFeedback({ type: "error", message: goalRequired ? "Create an active savings goal before using automatic airtime round-ups." : "Enter a phone number and airtime amount to continue." }); return; }
    try {
      const result = await purchaseMutation.mutateAsync({ amount: numericAmount, phone: `+254${recipient}`, description: `Airtime for +254${recipient}`, idempotencyKey: `airtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
      setFeedback({ type: "success", result });
      setAmount("");
    } catch (error) { setFeedback({ type: "error", message: error.response?.data?.message || error.message || "We could not buy airtime." }); }
  }

  if (loadError) return <ServicePageShell current="Airtime" feedback={{ type: "error", message: "We could not load the airtime flow." }} />;
  return <ServicePageShell current="Airtime" feedback={feedback?.type === "error" ? feedback : null}>
    {feedback?.type === "success" ? <section className="service-feedback service-feedback-success" role="status"><strong>Airtime purchased</strong><span>{formatKsh(feedback.result.amount)} airtime was sent to +254{recipient}.</span><dl className="service-preview-list"><div><dt>Automatic savings</dt><dd className="service-preview-success">{formatKsh(feedback.result.savingsAmount)}</dd></div><div><dt>Total wallet deduction</dt><dd>{formatKsh(feedback.result.chargedAmount)}</dd></div><div><dt>Savings goal</dt><dd>{feedback.result.goal?.name || "Savings"}</dd></div><div><dt>Goal progress</dt><dd>{formatKsh(feedback.result.goal?.savedAmount || 0)} / {formatKsh(feedback.result.goal?.targetAmount || 0)}</dd></div></dl></section> : null}
    <form className="service-flow-grid" onSubmit={handleSubmit}>
      <ServiceFormCard label="Wallet service" title="Buy Airtime" badge="Auto round-up on" subtitle="Buy airtime as usual. AirSave quietly saves the difference.">
        <PhoneInput label="Phone number" value={recipient} onChange={setPhone} placeholder="700 000 000" />
        <AmountInput label="Airtime amount" value={amount} onChange={setAmount} placeholder="87" />
        {goalRequired ? <div className="service-feedback service-feedback-error"><strong>Active goal needed</strong><span>Your {formatKsh(roundUp.savings)} round-up needs a goal destination.</span><button type="button" onClick={() => navigate("/save/create")}>Create a goal</button></div> : null}
      </ServiceFormCard>
      <TransactionPreview totalLabel="Total wallet deduction" totalAmount={roundUp.rounded} rows={[{ label: "Airtime", value: formatKsh(numericAmount) }, { label: "Round-up rule", value: `Nearest ${roundUpRule}` }, { label: "Automatic savings", value: formatKsh(roundUp.savings), tone: "success" }, { label: "Savings goal", value: activeGoal?.name || "Create an active goal" }]}>
        <button className="service-primary-action" type="submit" disabled={!canSubmit}>{purchaseMutation.isPending ? "Confirming..." : "Buy Airtime"}</button>
        <button className="service-secondary-action" type="button" onClick={() => navigate("/settings")}>Manage round-up</button>
      </TransactionPreview>
    </form>
    <RecentServiceActivity title="Recent airtime" items={activityRows(activityQuery.data)} emptyMessage="No airtime purchases yet." />
  </ServicePageShell>;
}
