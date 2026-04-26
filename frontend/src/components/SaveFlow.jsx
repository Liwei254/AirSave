import { useEffect, useMemo, useState } from "react";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import FilterTabs from "./FilterTabs.jsx";
import Input from "./Input.jsx";
import MpesaPreview from "./MpesaPreview.jsx";
import QuickAddButtons from "./QuickAddButtons.jsx";
import SectionHeader from "./SectionHeader.jsx";
import {
  getMostRecentGoalId,
  phonePattern,
  quickAddOptions,
  recentGoalStorageKey,
  recentPhoneStorageKey,
  roundingOptions,
  toAmount,
} from "../utils/savings";

const stepLabels = [
  { title: "Amount", detail: "Set your charge and number" },
  { title: "Destination", detail: "Choose a goal and rule" },
  { title: "Confirm", detail: "Review before the prompt" },
];

export default function SaveFlow({ goals, activity, onSubmit, isSubmitting, initialGoalId = "" }) {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [rule, setRule] = useState(10);
  const [feedback, setFeedback] = useState(null);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status !== "completed"), [goals]);

  useEffect(() => {
    const storedPhone = localStorage.getItem(recentPhoneStorageKey);
    if (storedPhone) {
      setPhone(storedPhone);
    }
  }, []);

  useEffect(() => {
    if (!activeGoals.length) {
      setSelectedGoal("");
      return;
    }

    setSelectedGoal((current) => {
      if (current && activeGoals.some((goal) => goal._id === current)) {
        return current;
      }

      if (initialGoalId && activeGoals.some((goal) => goal._id === initialGoalId)) {
        return initialGoalId;
      }

      return getMostRecentGoalId(activeGoals, activity);
    });
  }, [activeGoals, activity, initialGoalId]);

  const numericAmount = toAmount(amount);
  const roundedAmount = amount ? Math.ceil(numericAmount / rule) * rule : 0;
  const savingsAmount = amount ? Math.max(0, roundedAmount - numericAmount) : 0;
  const selectedGoalItem = activeGoals.find((goal) => goal._id === selectedGoal) || null;
  const phoneError = phone.trim() && !phonePattern.test(phone.trim()) ? "Use 07XXXXXXXX or +254XXXXXXXXX." : "";
  const reviewReady = numericAmount > 0 && Boolean(selectedGoalItem) && phone.trim() && !phoneError;
  const currentStep = numericAmount <= 0 ? 1 : !selectedGoalItem ? 2 : 3;

  async function handleConfirm(event) {
    event.preventDefault();

    if (!reviewReady) {
      setFeedback({ type: "error", message: "Complete the amount, goal, and phone number to continue." });
      return;
    }

    setFeedback(null);

    try {
      await onSubmit({ amount: numericAmount, phone: phone.trim(), goalId: selectedGoal, rule });
      localStorage.setItem(recentPhoneStorageKey, phone.trim());
      localStorage.setItem(recentGoalStorageKey, selectedGoal);
      setAmount("");
      setFeedback({ type: "success", message: "Payment request sent to your phone." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not send the payment request.",
      });
    }
  }

  function handleQuickAdd(value) {
    const nextAmount = toAmount(amount) + value;
    setAmount(String(nextAmount));
  }

  return (
    <div className="action-page-shell">
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success savings-feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <Card className="action-page-card save-action-card" hover={false}>
        <SectionHeader
          title="Save with M-Pesa"
          subtitle="Move through the flow in three clear steps, then confirm from a premium preview panel."
        />

        <div className="compact-step-indicator">
          {stepLabels.map((step, index) => {
            const stepNumber = index + 1;
            const active = currentStep === stepNumber || (stepNumber === 3 && reviewReady);
            const complete = currentStep > stepNumber || (stepNumber === 3 && reviewReady);
            return (
              <div key={step.title} className={["compact-step", active ? "compact-step-active" : "", complete ? "compact-step-complete" : ""].filter(Boolean).join(" ")}>
                <span className="compact-step-number">{stepNumber}</span>
                <span className="compact-step-copy">
                  <span className="compact-step-label">{step.title}</span>
                  <span className="compact-step-detail">{step.detail}</span>
                </span>
              </div>
            );
          })}
        </div>

        <form className="fixed-action-grid action-panel-grid" onSubmit={handleConfirm}>
          <Card className="action-mini-card" hover={false}>
            <SectionHeader title="1. Amount" subtitle="Start with the amount and phone number." />
            <Input
              label="Amount"
              className="prominent-input"
              type="number"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <QuickAddButtons options={quickAddOptions} onAdd={handleQuickAdd} />
            <Input
              label="Phone number"
              type="tel"
              placeholder="07XXXXXXXX or +254XXXXXXXXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              helper="Most users save KES 50-200"
              error={phoneError}
            />
          </Card>

          <Card className="action-mini-card" hover={false}>
            <SectionHeader title="2. Destination" subtitle="Pick the goal and round-up logic." />
            <div className="save-panel-subtitle">Where do you want to save?</div>
            <FilterTabs
              items={activeGoals.map((goal) => ({ value: goal._id, label: goal.name }))}
              value={selectedGoal}
              onChange={setSelectedGoal}
              className="goal-filter-tabs"
            />
            <div className="save-panel-subtitle">Rounding logic</div>
            <FilterTabs
              items={roundingOptions.map((option) => ({ value: option.value, label: option.label }))}
              value={rule}
              onChange={setRule}
            />
            <div className="compact-helper-card">
              <strong>{selectedGoalItem ? `You will save KES ${savingsAmount} after fees` : "Select a goal to continue"}</strong>
              <span>Your most recent goal is auto-selected to reduce steps and keep the flow fast.</span>
            </div>
          </Card>

          <div className="action-preview-column">
            <MpesaPreview
              chargedAmount={roundedAmount}
              savingsAmount={savingsAmount}
              goalName={selectedGoalItem?.name}
              isReady={reviewReady}
              sticky={false}
              confirmLabel={isSubmitting ? "Sending request..." : "Confirm Save"}
              confirmDisabled={!reviewReady || isSubmitting}
              helperText="Takes ~5 seconds"
              trustText="You will receive an M-Pesa prompt"
            />
          </div>
        </form>
      </Card>
    </div>
  );
}
