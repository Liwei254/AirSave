import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import FilterTabs from "../components/FilterTabs.jsx";
import Input from "../components/Input.jsx";
import Layout from "../components/Layout.jsx";
import MpesaPreview from "../components/MpesaPreview.jsx";
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
  const previewCharged = Math.min(numericAmount, availableBalance);

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

  return (
    <Layout eyebrow="Withdraw" title="Withdraw your savings" subtitle="Choose a source, preview the amount, and confirm the withdrawal with clear safety messaging.">
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

      <section className="stats-grid">
        <StatCard label="Wallet balance" value={formatCurrency(wallet?.balance)} hint="Available immediately from your savings wallet" tone="cool" />
        <StatCard label="Goals available" value={String(goals.length)} hint="You can withdraw from wallet or a selected goal" />
        <StatCard label="Selected source" value={selectedGoal ? selectedGoal.name : "Wallet"} hint="Current withdrawal source" tone="success" />
      </section>

      <section className="content-grid-main">
        <div className="content-main-column page-stack">
          <Card>
            <SectionHeader title="Withdrawal request" subtitle="Select where the funds should come from and how much you want to withdraw." />
            {isLoading ? (
              <div className="loading-panel">
                <span className="spinner spinner-dark" aria-hidden="true" />
                <span>Loading withdrawal details...</span>
              </div>
            ) : (
              <form className="page-stack-sm" onSubmit={handleSubmit}>
                <Input label="Amount" type="number" min="1" placeholder="Enter amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
                <FilterTabs
                  items={sourceOptions.map((option) => ({ value: option.value, label: option.label }))}
                  value={selectedSource?.value || "wallet"}
                  onChange={(value) => {
                    setSource(value);
                    setBreakGoal(false);
                    setNeedsBreakConfirmation(false);
                  }}
                />

                {showMaturityWarning ? (
                  <Card className="warning-card" hover={false}>
                    <SectionHeader title="Goal not matured" subtitle={`${selectedGoal.name} is still in progress. Break the goal to continue, or switch back to wallet.`} />
                    <div className="goal-card-actions">
                      <Button type="button" variant={breakGoal ? "primary" : "secondary"} onClick={() => { setBreakGoal(true); setNeedsBreakConfirmation(false); }}>
                        Break goal
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => { setSource("wallet"); setBreakGoal(false); setNeedsBreakConfirmation(false); }}>
                        Cancel
                      </Button>
                    </div>
                  </Card>
                ) : null}

                {needsBreakConfirmation && !breakGoal ? (
                  <div className="feedback feedback-error">
                    <strong>Action required:</strong>
                    <span>Select Break goal to continue with this withdrawal.</span>
                  </div>
                ) : null}

                <div className="confirm-section">
                  <SectionHeader title="Confirm withdrawal" subtitle="Review the preview on the right before you submit." />
                  <Button type="submit" fullWidth className="sm-auto" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit withdrawal request"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>

        <div className="content-side-column">
          <MpesaPreview chargedAmount={previewCharged} savingsAmount={previewCharged} goalName={selectedGoal?.name || "Savings wallet"} isReady={numericAmount > 0} sticky />
        </div>
      </section>
    </Layout>
  );
}
