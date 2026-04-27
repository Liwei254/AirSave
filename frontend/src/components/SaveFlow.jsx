import { useEffect, useMemo, useState } from "react";
import FormCard from "./FormCard.jsx";
import FormSection from "./FormSection.jsx";
import FormPageLayout from "./FormPageLayout.jsx";
import Input from "./Input.jsx";
import MpesaPreview from "./MpesaPreview.jsx";
import SelectPill from "./SelectPill.jsx";
import StepIndicator from "./StepIndicator.jsx";
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
    event?.preventDefault();

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

      <form onSubmit={handleConfirm}>
        <FormPageLayout className="save-flow-grid">
          <FormCard className="save-form-card">
            <div className="save-flow-header">
              <span className="save-flow-kicker">M-Pesa</span>
              <h2 className="save-flow-title">Save with M-Pesa</h2>
            </div>

            <StepIndicator steps={stepLabels} currentStep={currentStep} completeStep={reviewReady ? 3 : 0} ariaLabel="Save progress" />

            <div className="save-form-stack">
              <FormSection title="Amount" active={currentStep >= 1}>
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
              </FormSection>

              <FormSection title="Phone" active={currentStep >= 1}>
                <Input
                  id="savePhone"
                  type="tel"
                  placeholder="07XXXXXXXX or +254XXXXXXXXX"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  error={phoneError}
                  className="save-clean-input"
                />
              </FormSection>

            <FormSection title="Goal" active={currentStep >= 2}>
              <SelectPill
                items={activeGoals.map((goal) => ({ value: goal._id, label: goal.name }))}
                value={selectedGoal}
                  onChange={setSelectedGoal}
                  ariaLabel="Savings goals"
                />
              </FormSection>

              <FormSection title="Round-up rule" active={currentStep >= 2}>
                <SelectPill
                  items={roundingOptions.map((option) => ({ value: option.value, label: option.label }))}
                  value={rule}
                  onChange={setRule}
                  ariaLabel="Round-up options"
                />
              </FormSection>

              <div className="save-security-note">Secure M-Pesa transaction</div>
            </div>
          </FormCard>

          <div className="save-preview-column">
            <MpesaPreview
              chargedAmount={roundedAmount}
              savingsAmount={savingsAmount}
              goalName={selectedGoalItem?.name}
              isReady={reviewReady}
              sticky
              onConfirm={handleConfirm}
              confirmLabel={isSubmitting ? "Sending request..." : "Confirm Save"}
              confirmDisabled={!reviewReady || isSubmitting}
              loading={isSubmitting}
              helperText="Confirm the prompt to complete your save."
              trustText="Secure M-Pesa transaction"
            />
          </div>
        </FormPageLayout>
      </form>
    </div>
  );
}
