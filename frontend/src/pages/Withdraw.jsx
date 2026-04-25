import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import FilterTabs from "../components/FilterTabs.jsx";
import Input from "../components/Input.jsx";
import Layout from "../components/Layout.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import { getGoals, getWallet, submitWithdrawal } from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { formatCurrency } from "../utils/formatters";
import { toAmount } from "../utils/savings";

export default function Withdraw() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("wallet");
  const [phone, setPhone] = useState("");
  const [breakGoal, setBreakGoal] = useState(false);
  const [needsBreakConfirmation, setNeedsBreakConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");

  const loadWithdrawPage = useCallback(async (isMounted = true) => {
    try {
      const [walletData, goalsData] = await Promise.all([getWallet(), getGoals()]);
      if (!isMounted) return;
      setWallet(walletData);
      setGoals(goalsData);
      setError("");
    } catch (err) {
      if (!isMounted) return;
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || err.message || "We could not load your withdrawal options.");
    } finally {
      if (isMounted) setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;
    loadWithdrawPage(isMounted);
    return () => {
      isMounted = false;
    };
  }, [loadWithdrawPage]);

  const sourceOptions = useMemo(
    () => [
      { value: "wallet", label: `Savings wallet (${formatCurrency(wallet?.balance)})`, type: "wallet" },
      ...goals.map((goal) => ({ value: `goal:${goal._id}`, label: goal.name, type: "goal", goal })),
    ],
    [goals, wallet?.balance]
  );

  const selectedSource = sourceOptions.find((option) => option.value === source) || sourceOptions[0];
  const selectedGoal = selectedSource?.goal || null;
  const showMaturityWarning = Boolean(selectedGoal && selectedGoal.status !== "completed");
  const numericAmount = toAmount(amount);
  const availableBalance = selectedGoal ? toAmount(selectedGoal.savedAmount) : toAmount(wallet?.balance);
  const totalDeducted = Math.min(numericAmount, availableBalance);
  const fee = totalDeducted > 0 ? Math.min(50, Math.round(totalDeducted * 0.02)) : 0;
  const receiveAmount = Math.max(0, totalDeducted - fee);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!amount || Number(amount) <= 0 || !selectedSource) {
      return;
    }

    if (showMaturityWarning && !breakGoal) {
      setNeedsBreakConfirmation(true);
      setFeedback(null);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await submitWithdrawal(
        selectedSource.type === "goal"
          ? { amount: Number(amount), sourceType: "goal", sourceId: selectedGoal._id, breakGoal }
          : { amount: Number(amount), sourceType: "wallet" }
      );

      setAmount("");
      setBreakGoal(false);
      setNeedsBreakConfirmation(false);
      setFeedback({ type: "success", message: response.message || "Withdrawal submitted successfully." });
      await loadWithdrawPage(true);
      triggerDashboardRefresh();
    } catch (err) {
      const message = err.response?.data?.message || "Withdrawal request failed.";
      setFeedback({ type: "error", message });
      setNeedsBreakConfirmation(err.response?.data?.code === "GOAL_NOT_MATURED");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleQuickAmount(multiplier) {
    const nextAmount = Math.floor(availableBalance * multiplier);
    setAmount(String(nextAmount));
  }

  return (
    <Layout eyebrow="Withdraw" title="Withdraw your savings" subtitle="Keep the request, destination, and preview visible in one compact action panel.">
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="overflow-grid-shell">
        <section className="fixed-stats-grid">
          <StatCard label="Wallet balance" value={formatCurrency(wallet?.balance)} hint="Available immediately from your savings wallet" tone="cool" />
          <StatCard label="Goals available" value={String(goals.length)} hint="You can withdraw from wallet or a selected goal" />
          <StatCard label="Selected source" value={selectedGoal ? selectedGoal.name : "Wallet"} hint="Current withdrawal source" tone="success" />
        </section>
      </div>

      <div className="action-page-shell">
        <Card className="action-page-card" hover={false}>
          <SectionHeader title="Withdraw funds" subtitle="Amount, destination, preview, and confirmation stay visible above the fold." />

          {isLoading ? (
            <div className="loading-panel">
              <span className="spinner spinner-dark" aria-hidden="true" />
              <span>Loading withdrawal details...</span>
            </div>
          ) : (
            <form className="fixed-action-grid withdraw-panel-grid" onSubmit={handleSubmit}>
              <Card className="action-mini-card" hover={false}>
                <SectionHeader title="Amount" subtitle="Choose how much to withdraw from the selected balance." />
                <div className="compact-helper-card">
                  <strong>Available balance: {formatCurrency(availableBalance)}</strong>
                  <span>Use a quick amount or enter a custom withdrawal value.</span>
                </div>
                <Input label="Withdraw amount" type="number" min="1" placeholder="Enter amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
                <FilterTabs
                  items={[
                    { value: "quarter", label: "25%" },
                    { value: "half", label: "50%" },
                    { value: "max", label: "Max" },
                  ]}
                  value=""
                  onChange={(value) => {
                    if (value === "quarter") handleQuickAmount(0.25);
                    if (value === "half") handleQuickAmount(0.5);
                    if (value === "max") handleQuickAmount(1);
                  }}
                />
              </Card>

              <Card className="action-mini-card" hover={false}>
                <SectionHeader title="Destination" subtitle="Select the source and destination details for this withdrawal." />
                <FilterTabs
                  items={sourceOptions.map((option) => ({ value: option.value, label: option.label }))}
                  value={selectedSource?.value || "wallet"}
                  onChange={(value) => {
                    setSource(value);
                    setBreakGoal(false);
                    setNeedsBreakConfirmation(false);
                  }}
                />
                <Input label="Phone number" type="tel" placeholder="07XXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} helper="Used for payout confirmation if required by the processor." />
                <div className="compact-helper-card">
                  <strong>Fee note</strong>
                  <span>Estimated processing fee is shown in the preview before you confirm.</span>
                </div>
                {showMaturityWarning ? (
                  <div className="compact-helper-card compact-helper-card-warning">
                    <strong>This goal has not matured.</strong>
                    <span>{selectedGoal.name} is still in progress. Break the goal to continue, or switch back to wallet.</span>
                    <div className="goal-card-actions">
                      <Button type="button" variant={breakGoal ? "primary" : "secondary"} onClick={() => { setBreakGoal(true); setNeedsBreakConfirmation(false); }}>
                        Break goal
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => { setSource("wallet"); setBreakGoal(false); setNeedsBreakConfirmation(false); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                {needsBreakConfirmation && !breakGoal ? (
                  <div className="feedback feedback-error">
                    <strong>Action required:</strong>
                    <span>Select Break goal to continue with this withdrawal.</span>
                  </div>
                ) : null}
              </Card>

              <div className="action-preview-column">
                <Card className="action-mini-card withdraw-preview-card" hover={false}>
                  <SectionHeader title="Preview + Confirm" subtitle="Review fee, payout, and total deduction before submitting." />
                  <div className="preview-metric preview-metric-primary">
                    <span>Amount to receive</span>
                    <strong>{formatCurrency(receiveAmount)}</strong>
                  </div>
                  <div className="withdraw-preview-list">
                    <div className="withdraw-preview-row">
                      <span>Fee</span>
                      <strong>{formatCurrency(fee)}</strong>
                    </div>
                    <div className="withdraw-preview-row">
                      <span>Total deducted</span>
                      <strong>{formatCurrency(totalDeducted)}</strong>
                    </div>
                  </div>
                  <Button type="submit" fullWidth disabled={isSubmitting || !numericAmount}>
                    {isSubmitting ? "Submitting..." : "Confirm Withdraw"}
                  </Button>
                </Card>
              </div>
            </form>
          )}
        </Card>
      </div>
    </Layout>
  );
}
