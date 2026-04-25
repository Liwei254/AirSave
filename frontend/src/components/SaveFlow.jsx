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

const stepLabels = ["Enter amount", "Select goal", "Review", "Confirm"];

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
  const step1Ready = numericAmount > 0;
  const step2Ready = Boolean(selectedGoalItem);
  const reviewReady = step1Ready && step2Ready && phone.trim() && !phoneError;
  const currentStep = !step1Ready ? 1 : !step2Ready ? 2 : !reviewReady ? 3 : 4;

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
      setFeedback({ type: "error", message: error.response?.data?.message || error.message || "We could not send the payment request." });
    }
  }

  function handleQuickAdd(value) {
    const nextAmount = toAmount(amount) + value;
    setAmount(String(nextAmount));
  }

  return (
    <div className="content-grid-main">
      <div className="content-main-column">
        {feedback ? (
          <div className={`feedback ${feedback.type === "success" ? "feedback-success savings-feedback-success" : "feedback-error"}`}>
            <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
            <span>{feedback.message}</span>
          </div>
        ) : null}

        <Card className="save-flow-card">
          <SectionHeader title="Save with M-Pesa" subtitle="Move through the flow one step at a time with less clutter and a clear preview." />
          <div className="step-indicator">
            {stepLabels.map((label, index) => {
              const stepNumber = index + 1;
              const active = currentStep === stepNumber;
              const complete = currentStep > stepNumber || (stepNumber === 4 && reviewReady);
              return (
                <div key={label} className={["step-item", active ? "step-item-active" : "", complete ? "step-item-complete" : ""].filter(Boolean).join(" ")}>
                  <div className="step-node">{stepNumber}</div>
                  <div className="step-copy">{label}</div>
                  {index < stepLabels.length - 1 ? <div className="step-connector" /> : null}
                </div>
              );
            })}
          </div>
        </Card>

        <form className="page-stack" onSubmit={handleConfirm}>
          <Card>
            <SectionHeader title="Step 1: Enter amount" subtitle="Use a quick amount or type the number you want to save." />
            <div className="page-stack-sm">
              <Input label="Amount" type="number" min="1" placeholder="Enter amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <QuickAddButtons options={quickAddOptions} onAdd={handleQuickAdd} />
            </div>
          </Card>

          {step1Ready ? (
            <Card className="fade-in-card">
              <SectionHeader title="Step 2: Select goal" subtitle="Your most recent goal is pre-selected. Tap another goal if needed." />
              <FilterTabs items={activeGoals.map((goal) => ({ value: goal._id, label: goal.name }))} value={selectedGoal} onChange={setSelectedGoal} className="goal-filter-tabs" />
            </Card>
          ) : null}

          {step2Ready ? (
            <Card className="fade-in-card page-stack-sm">
              <SectionHeader title="Step 3: Review details" subtitle="We will send the payment request to this phone number." />
              <Input label="Phone number" type="tel" placeholder="07XXXXXXXX or +254XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} helper="We auto-fill your last used number when available." error={phoneError} />
              <FilterTabs items={roundingOptions.map((option) => ({ value: option.value, label: option.label }))} value={rule} onChange={setRule} />
            </Card>
          ) : null}

          {step2Ready ? (
            <Card className="fade-in-card">
              <div className="confirm-section">
                <SectionHeader title="Step 4: Confirm save" subtitle="Transaction includes fee. We update your balance after confirmation." />
                <Button type="submit" fullWidth className="sm-auto" disabled={!reviewReady || isSubmitting}>{isSubmitting ? "Sending request..." : "Confirm save"}</Button>
              </div>
            </Card>
          ) : null}
        </form>
      </div>

      <div className="content-side-column">
        <MpesaPreview chargedAmount={roundedAmount} savingsAmount={savingsAmount} goalName={selectedGoalItem?.name} isReady={reviewReady} sticky />
      </div>
    </div>
  );
}
