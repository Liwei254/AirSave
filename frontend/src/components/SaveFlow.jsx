import { useEffect, useMemo, useState } from "react";
import QuickAddButtons from "./QuickAddButtons.jsx";
import MpesaPreview from "./MpesaPreview.jsx";
import {
  getMostRecentGoalId,
  phonePattern,
  quickAddOptions,
  recentGoalStorageKey,
  recentPhoneStorageKey,
  roundingOptions,
  toAmount,
} from "../utils/savings";

export default function SaveFlow({ goals, activity, onSubmit, isSubmitting }) {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [rule, setRule] = useState(10);
  const [feedback, setFeedback] = useState(null);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status !== "completed"),
    [goals]
  );

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

      return getMostRecentGoalId(activeGoals, activity);
    });
  }, [activeGoals, activity]);

  const numericAmount = toAmount(amount);
  const roundedAmount = amount ? Math.ceil(numericAmount / rule) * rule : 0;
  const savingsAmount = amount ? Math.max(0, roundedAmount - numericAmount) : 0;
  const selectedGoalItem = activeGoals.find((goal) => goal._id === selectedGoal) || null;
  const phoneError = phone.trim() && !phonePattern.test(phone.trim())
    ? "Use 07XXXXXXXX or +254XXXXXXXXX."
    : "";
  const canContinueAmount = numericAmount > 0;
  const canContinueGoal = Boolean(selectedGoalItem);
  const canReview = canContinueAmount && canContinueGoal && phone.trim() && !phoneError;
  const currentStep = !canContinueAmount ? 1 : !canContinueGoal ? 2 : !canReview ? 3 : 4;

  async function handleConfirm(event) {
    event.preventDefault();

    if (!canReview) {
      setFeedback({ type: "error", message: "Complete the amount, goal, and phone number to continue." });
      return;
    }

    setFeedback(null);

    try {
      await onSubmit({
        amount: numericAmount,
        phone: phone.trim(),
        goalId: selectedGoal,
        rule,
      });

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
    <div className="save-flow-shell">
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success savings-feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <div className="save-step-row">
        <div className={`save-step ${currentStep === 1 ? "save-step-active" : ""} ${canContinueAmount ? "save-step-complete" : ""}`}>
          <span className="save-step-number">1</span>
          <div className="save-step-title">Enter amount</div>
        </div>
        <div className={`save-step ${currentStep === 2 ? "save-step-active" : ""} ${canContinueGoal ? "save-step-complete" : ""}`}>
          <span className="save-step-number">2</span>
          <div className="save-step-title">Select goal</div>
        </div>
        <div className={`save-step ${currentStep === 3 ? "save-step-active" : ""} ${canReview ? "save-step-complete" : ""}`}>
          <span className="save-step-number">3</span>
          <div className="save-step-title">Review M-Pesa</div>
        </div>
        <div className={`save-step ${currentStep === 4 ? "save-step-active" : ""}`}>
          <span className="save-step-number">4</span>
          <div className="save-step-title">Confirm</div>
        </div>
      </div>

      <form className="save-flow-form" onSubmit={handleConfirm}>
        <section className="app-card save-section-card">
          <div className="card-header savings-card-header">
            <div>
              <h2 className="card-title">Step 1: Enter amount</h2>
              <p className="card-subtitle">Start with the amount you want to save today.</p>
            </div>
          </div>

          <label className="field-group">
            <span className="field-label">Amount</span>
            <input
              className="app-input"
              type="number"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <QuickAddButtons options={quickAddOptions} onAdd={handleQuickAdd} />
        </section>

        {canContinueAmount ? (
          <section className="app-card save-section-card fade-in-card">
            <div className="card-header savings-card-header">
              <div>
                <h2 className="card-title">Step 2: Select goal</h2>
                <p className="card-subtitle">We auto-selected your most recent goal. Change it anytime.</p>
              </div>
            </div>

            <div className="goal-chip-grid">
              {activeGoals.map((goal) => (
                <button
                  key={goal._id}
                  type="button"
                  className={`goal-chip ${selectedGoal === goal._id ? "goal-chip-active" : ""}`}
                  onClick={() => setSelectedGoal(goal._id)}
                >
                  <span>{goal.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {canContinueGoal ? (
          <section className="app-card save-section-card fade-in-card">
            <div className="save-section-grid">
              <div>
                <div className="card-header savings-card-header">
                  <div>
                    <h2 className="card-title">Step 3: Review M-Pesa</h2>
                    <p className="card-subtitle">You will receive an M-Pesa prompt on this number.</p>
                  </div>
                </div>

                <label className="field-group">
                  <span className="field-label">Phone number</span>
                  <input
                    className="app-input"
                    type="tel"
                    placeholder="07XXXXXXXX or +254XXXXXXXXX"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                  <span className="helper-text">We auto-fill your last used number when available.</span>
                  {phoneError ? <span className="helper-text savings-error-text">{phoneError}</span> : null}
                </label>

                <div className="goal-chip-grid goal-chip-grid-compact">
                  {roundingOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`goal-chip ${rule === option.value ? "goal-chip-active" : ""}`}
                      onClick={() => setRule(option.value)}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <MpesaPreview
                chargedAmount={roundedAmount}
                savingsAmount={savingsAmount}
                goalName={selectedGoalItem?.name}
                isReady={canReview}
              />
            </div>
          </section>
        ) : null}

        {canContinueGoal ? (
          <section className="app-card save-section-card fade-in-card">
            <div className="save-confirm-row">
              <div>
                <h2 className="card-title">Step 4: Confirm save</h2>
                <p className="card-subtitle">Transaction includes fee. We only update your dashboard after confirmation.</p>
              </div>
              <button className="app-button app-button-primary save-submit-button" type="submit" disabled={!canReview || isSubmitting}>
                {isSubmitting ? "Sending request..." : "Confirm save"}
              </button>
            </div>
          </section>
        ) : null}
      </form>
    </div>
  );
}

