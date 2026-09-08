import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveGoalQuery, useAllocateSavingsMutation, useWalletQuery } from "../api/hooks";
import {
  AmountInput,
  RecentServiceActivity,
  ServiceFormCard,
  ServicePageShell,
  TransactionPreview,
} from "../components/ServicePageComponents.jsx";
import { formatKsh, toAmount } from "../utils/servicePage";
import { formatCurrency, formatDate } from "../utils/formatters";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `SAVE-${crypto.randomUUID()}`;
  }
  return `SAVE-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function AddSavings() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const activeGoalQuery = useActiveGoalQuery();
  const walletQuery = useWalletQuery();
  const allocateMutation = useAllocateSavingsMutation();

  const goal = activeGoalQuery.data;
  const wallet = walletQuery.data;
  const numericAmount = toAmount(amount);
  const walletBalance = Number(wallet?.balance ?? wallet?.availableBalance ?? 0);
  const newWalletBalance = Math.max(0, walletBalance - numericAmount);
  const remainingAfterSave = Math.max(0, Number(goal?.targetAmount || 0) - Number(goal?.currentAmount ?? goal?.savedAmount ?? 0) - numericAmount);
  const isLoading = activeGoalQuery.isLoading || walletQuery.isLoading;
  const loadError = activeGoalQuery.error || walletQuery.error;
  const canConfirm = Boolean(goal) && numericAmount > 0 && numericAmount <= walletBalance && !allocateMutation.isPending;

  const activity = useMemo(() => {
    const rows = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
    return rows.filter((item) => String(item.transactionType || item.type || "").toLowerCase() === "save").slice(0, 5);
  }, [wallet]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!goal) {
      setFeedback({ type: "error", message: "You need an active savings goal before adding savings." });
      return;
    }

    if (!numericAmount) {
      setFeedback({ type: "error", message: "Enter an amount greater than zero." });
      return;
    }

    if (numericAmount > walletBalance) {
      setFeedback({ type: "error", message: "Insufficient wallet balance. Deposit funds before adding savings." });
      return;
    }

    setFeedback(null);

    try {
      const result = await allocateMutation.mutateAsync({
        amount: numericAmount,
        goalId: goal._id || goal.id,
        idempotencyKey: createIdempotencyKey(),
        description: note.trim() || `Manual savings for ${goal.name}`,
      });

      setAmount("");
      setNote("");
      setSubmitted(false);
      setFeedback({ type: "success", message: result.message || "Savings added successfully." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not add your savings.",
      });
    }
  }

  if (isLoading) {
    return (
      <ServicePageShell current="Add savings" parentLabel="Save" parentPath="/save" trail={[{ label: "Save", path: "/save" }, { label: "Add savings" }]}>
        <section className="service-loading-card">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading savings flow...</span>
        </section>
      </ServicePageShell>
    );
  }

  if (loadError || !goal) {
    return (
      <ServicePageShell
        current="Add savings"
        parentLabel="Save"
        parentPath="/save"
        trail={[{ label: "Save", path: "/save" }, { label: "Add savings" }]}
        feedback={feedback || (loadError ? { type: "error", message: loadError.message || "We could not load your savings details." } : null)}
      >
        <section className="service-form-card">
          <div className="service-form-heading">
            <div>
              <span className="service-kicker">My Goal</span>
              <h1><span>No active goal</span></h1>
            </div>
          </div>
          <p className="service-form-subtitle">Create a savings goal first, then return here to add money to it.</p>
          <button className="service-primary-action" type="button" onClick={() => navigate("/save/create")}>Create savings goal</button>
        </section>
      </ServicePageShell>
    );
  }

  return (
    <ServicePageShell
      current="Add savings"
      parentLabel="Save"
      parentPath="/save"
      trail={[{ label: "Save", path: "/save" }, { label: "Add savings" }]}
      feedback={feedback}
    >
      <form className="service-layout-grid" onSubmit={handleSubmit}>
        <ServiceFormCard
          label="Goal savings"
          title={["Add", "Savings"]}
          badge="Active goal"
          subtitle={`Add money directly to ${goal.name}. This moves funds from your available wallet balance into your savings goal.`}
        >
          <div className="service-field">
            <span>Goal</span>
            <div className="service-readonly-value">{goal.name}</div>
          </div>

          <div className="service-field">
            <span>Current progress</span>
            <div className="service-readonly-value">
              {formatCurrency(goal.currentAmount ?? goal.savedAmount ?? 0)} of {formatCurrency(goal.targetAmount)}
            </div>
          </div>

          <AmountInput
            label="Amount to save"
            value={amount}
            onChange={setAmount}
            placeholder="1,000"
            error={submitted && (!numericAmount || numericAmount > walletBalance)}
          />

          <label className="service-field">
            <span>Optional note</span>
            <input
              className="service-dark-input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={240}
              placeholder="e.g. Weekly Field Trip savings"
            />
          </label>
        </ServiceFormCard>

        <TransactionPreview
          totalLabel="Savings amount"
          totalAmount={numericAmount}
          rows={[
            { label: "Goal", value: goal.name },
            { label: "Wallet balance", value: formatKsh(walletBalance) },
            { label: "After saving", value: formatKsh(newWalletBalance) },
            { label: "Goal remaining", value: formatKsh(remainingAfterSave), tone: "success" },
          ]}
        >
          <button className="service-primary-action" type="submit" disabled={!canConfirm}>
            {allocateMutation.isPending ? "Adding savings..." : "Add savings"}
          </button>
          <button className="service-secondary-action" type="button" onClick={() => navigate("/save")} disabled={allocateMutation.isPending}>
            Cancel
          </button>
        </TransactionPreview>
      </form>

      <RecentServiceActivity
        title="Recent goal savings"
        items={activity.map((item) => ({
          id: item._id || item.reference,
          title: item.goalName || goal.name,
          meta: `${formatDate(item.date || item.createdAt)} - ${item.status || "confirmed"}`,
          amount: item.savingsAmount ?? item.savings ?? item.amount ?? 0,
          helper: "Goal allocation",
        }))}
        emptyMessage="No manual goal savings yet."
      />
    </ServicePageShell>
  );
}
