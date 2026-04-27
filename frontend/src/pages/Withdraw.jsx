import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import ConfirmationCard from "../components/ConfirmationCard.jsx";
import FormSection from "../components/FormSection.jsx";
import FormCard from "../components/FormCard.jsx";
import FormPageLayout from "../components/FormPageLayout.jsx";
import Input from "../components/Input.jsx";
import Layout from "../components/Layout.jsx";
import SelectPill from "../components/SelectPill.jsx";
import StepIndicator from "../components/StepIndicator.jsx";
import { getGoals, getWallet, submitWithdrawal } from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { formatCurrency } from "../utils/formatters";
import { toAmount } from "../utils/savings";

const withdrawSteps = ["1", "2", "3"];

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
  const currentStep = numericAmount <= 0 ? 1 : !selectedSource ? 2 : 3;

  async function handleSubmit(event) {
    event?.preventDefault();

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
    <Layout eyebrow="Withdraw" title="Withdraw your savings" subtitle="Move funds out with a calmer, focused review flow.">
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

      {isLoading ? (
        <section className="ui-card loading-panel">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading withdrawal details...</span>
        </section>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormPageLayout>
            <FormCard className="withdraw-form-card">
              <StepIndicator
                steps={withdrawSteps}
                currentStep={currentStep}
                completeStep={numericAmount > 0 && selectedSource ? 3 : 0}
                ariaLabel="Withdraw progress"
              />

              <div className="fin-form-stack">
                <FormSection title="Amount" active={currentStep >= 1}>
                  <div className="fin-inline-metric">
                    <span>Available balance</span>
                    <strong>{formatCurrency(availableBalance)}</strong>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <SelectPill
                    items={[
                      { value: "quarter", label: "25%" },
                      { value: "half", label: "50%" },
                      { value: "max", label: "MAX" },
                    ]}
                    value=""
                    onChange={(value) => {
                      if (value === "quarter") handleQuickAmount(0.25);
                      if (value === "half") handleQuickAmount(0.5);
                      if (value === "max") handleQuickAmount(1);
                    }}
                    ariaLabel="Quick withdrawal amounts"
                  />
                </FormSection>

                <FormSection title="Source" active={currentStep >= 2}>
                  <SelectPill
                    items={sourceOptions.map((option) => ({ value: option.value, label: option.label }))}
                    value={selectedSource?.value || "wallet"}
                    onChange={(value) => {
                      setSource(value);
                      setBreakGoal(false);
                      setNeedsBreakConfirmation(false);
                    }}
                    ariaLabel="Withdrawal source"
                  />
                  <Input
                    label="Send to"
                    type="tel"
                    placeholder="07XXXXXXXX"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                  {showMaturityWarning ? (
                    <div className="fin-notice fin-notice-warning">
                      <strong>Goal still in progress</strong>
                      <span>{selectedGoal.name} must be broken before withdrawal can continue.</span>
                      <div className="fin-inline-actions">
                        <Button
                          type="button"
                          variant={breakGoal ? "primary" : "secondary"}
                          onClick={() => {
                            setBreakGoal(true);
                            setNeedsBreakConfirmation(false);
                          }}
                        >
                          Break goal
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setSource("wallet");
                            setBreakGoal(false);
                            setNeedsBreakConfirmation(false);
                          }}
                        >
                          Switch to wallet
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
                </FormSection>
              </div>
            </FormCard>

            <ConfirmationCard
              label="SUMMARY"
              title="Review withdrawal"
              amount={receiveAmount}
              rows={[
                { label: "Fee", value: formatCurrency(fee) },
                { label: "Total deducted", value: formatCurrency(totalDeducted) },
                { label: "Source", value: selectedGoal ? selectedGoal.name : "Savings wallet" },
              ]}
              buttonText={isSubmitting ? "Submitting..." : "Confirm Withdrawal"}
              onConfirm={handleSubmit}
              disabled={!numericAmount || isSubmitting}
              loading={isSubmitting}
              helperText="Withdrawals are reviewed before processing."
              variant="withdraw"
              sticky
            />
          </FormPageLayout>
        </form>
      )}
    </Layout>
  );
}
