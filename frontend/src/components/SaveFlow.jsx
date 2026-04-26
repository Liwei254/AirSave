import { useEffect, useMemo, useState } from "react";
import Card from "./Card.jsx";
import Input from "./Input.jsx";
import MpesaPreview from "./MpesaPreview.jsx";
import {
  getMostRecentGoalId,
  phonePattern,
  recentGoalStorageKey,
  recentPhoneStorageKey,
  roundingOptions,
  toAmount,
} from "../utils/savings";

const stepLabels = ["1", "2", "3"];

function parseAmountInput(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  return digitsOnly ? String(Number(digitsOnly)) : "";
}

function formatAmountInput(value) {
  const numeric = toAmount(value);
  if (!numeric) return "";
  return `Ksh ${new Intl.NumberFormat("en-KE").format(numeric)}`;
}

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

  return (
    <div className="save-flow-shell">
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success savings-feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <form className="save-flow-grid" onSubmit={handleConfirm}>
        <Card className="save-form-card" hover={false}>
          <div className="save-flow-header">
            <span className="save-flow-kicker">M-Pesa</span>
            <h2 className="save-flow-title">Save with M-Pesa</h2>
            <p className="save-flow-subtitle">
              Enter an amount, choose where it goes, then confirm the prompt from your phone.
            </p>
          </div>

          <div className="save-progress-minimal" aria-label="Save progress">
            {stepLabels.map((step, index) => {
              const stepNumber = index + 1;
              const active = currentStep === stepNumber || (stepNumber === 3 && reviewReady);
              const complete = currentStep > stepNumber || (stepNumber === 3 && reviewReady);

              return (
                <div
                  key={step}
                  className={[
                    "save-progress-item",
                    active ? "save-progress-item-active" : "",
                    complete ? "save-progress-item-complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="save-progress-dot">{step}</span>
                  {stepNumber < stepLabels.length ? <span className="save-progress-line" aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>

          <div className="save-form-stack">
            <div className="save-field-group">
              <label className="save-field-label" htmlFor="saveAmount">
                Amount
              </label>
              <input
                id="saveAmount"
                name="amount"
                className="save-clean-input save-clean-input-amount"
                type="text"
                inputMode="numeric"
                placeholder="Ksh 0"
                value={formatAmountInput(amount)}
                onChange={(event) => setAmount(parseAmountInput(event.target.value))}
              />
              <span className="save-field-note">Typical save: Ksh 50-500</span>
            </div>

            <div className="save-field-group">
              <Input
                id="savePhone"
                label="Phone number"
                type="tel"
                placeholder="07XXXXXXXX or +254XXXXXXXXX"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                error={phoneError}
                className="save-clean-input"
              />
            </div>

            <div className="save-field-group">
              <div className="save-field-heading">
                <span className="save-field-label">Goal</span>
                <span className="save-field-caption">Choose a destination</span>
              </div>
              <div className="save-goal-pills" role="list" aria-label="Savings goals">
                {activeGoals.map((goal) => (
                  <button
                    key={goal._id}
                    type="button"
                    className={["save-goal-pill", selectedGoal === goal._id ? "save-goal-pill-active" : ""].filter(Boolean).join(" ")}
                    onClick={() => setSelectedGoal(goal._id)}
                  >
                    {goal.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="save-field-group">
              <div className="save-field-heading">
                <span className="save-field-label">Round-up rule</span>
              </div>
              <div className="save-goal-pills save-rule-pills" role="list" aria-label="Round-up options">
                {roundingOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={["save-goal-pill", rule === option.value ? "save-goal-pill-active" : ""].filter(Boolean).join(" ")}
                    onClick={() => setRule(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="save-security-note">Secure M-Pesa transaction</div>
          </div>
        </Card>

        <div className="save-preview-column">
          <MpesaPreview
            chargedAmount={roundedAmount}
            savingsAmount={savingsAmount}
            goalName={selectedGoalItem?.name}
            isReady={reviewReady}
            sticky
            confirmLabel={isSubmitting ? "Sending request..." : "Confirm Save"}
            confirmDisabled={!reviewReady || isSubmitting}
            helperText="Confirm the prompt to complete your save."
            trustText="Secure M-Pesa transaction"
          />
        </div>
      </form>
    </div>
  );
}
