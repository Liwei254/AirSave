import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import FormCard from "../components/FormCard.jsx";
import FormSection from "../components/FormSection.jsx";
import FormPageLayout from "../components/FormPageLayout.jsx";
import Input from "../components/Input.jsx";
import Layout from "../components/Layout.jsx";
import SelectPill from "../components/SelectPill.jsx";
import ConfirmSummaryCard from "../components/ConfirmSummaryCard.jsx";
import { createGoal } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { durationUnits, goalTemplates, getSuggestedPlan, toAmount } from "../utils/savings";

const initialForm = { name: "", targetAmount: "", durationValue: "", durationUnit: "days" };

export default function GoalNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestedPlan = getSuggestedPlan(form.targetAmount, form.durationValue, form.durationUnit);
  const createDisabled = !form.name.trim() || toAmount(form.targetAmount) <= 0 || toAmount(form.durationValue) <= 0 || isSubmitting;

  function applyTemplate(templateName) {
    const template = goalTemplates.find((item) => item.name === templateName);
    if (!template) return;
    setForm({
      name: template.name,
      targetAmount: String(template.targetAmount),
      durationValue: template.durationValue,
      durationUnit: template.durationUnit,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (createDisabled) {
      setFeedback({ type: "error", message: "Complete all goal details to continue." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await createGoal({
        name: form.name.trim(),
        targetAmount: toAmount(form.targetAmount),
        duration: `${form.durationValue} ${form.durationUnit}`,
      });
      navigate("/goals");
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not create the goal.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout eyebrow="New Goal" title="Create a savings goal" subtitle="Set a target, choose a timeline, and review the plan in one place.">
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <FormPageLayout>
        <FormCard>
          <div className="fin-form-stack">
            <FormSection title="Template" active>
              <SelectPill
                items={goalTemplates.map((template) => ({ value: template.name, label: template.name }))}
                value={goalTemplates.some((template) => template.name === form.name) ? form.name : ""}
                onChange={applyTemplate}
                ariaLabel="Goal templates"
              />
            </FormSection>

            <FormSection title="Goal details" active>
              <div className="fin-form-two-col">
                <Input
                  label="Goal name"
                  type="text"
                  placeholder="Emergency fund"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
                <Input
                  label="Target amount"
                  type="number"
                  min="1"
                  placeholder="50000"
                  value={form.targetAmount}
                  onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))}
                />
              </div>
              <div className="fin-form-two-col">
                <Input
                  label="Duration"
                  type="number"
                  min="1"
                  placeholder="90"
                  value={form.durationValue}
                  onChange={(event) => setForm((current) => ({ ...current, durationValue: event.target.value }))}
                />
                <div className="fin-field-group">
                  <span className="field-label">Unit</span>
                  <SelectPill
                    items={durationUnits.map((option) => ({ value: option.value, label: option.label }))}
                    value={form.durationUnit}
                    onChange={(value) => setForm((current) => ({ ...current, durationUnit: value }))}
                    ariaLabel="Duration units"
                  />
                </div>
              </div>
            </FormSection>
          </div>
        </FormCard>

        <ConfirmSummaryCard
          eyebrow="Plan"
          title="Goal summary"
          footer={(
            <Button type="submit" fullWidth disabled={createDisabled}>
              {isSubmitting ? "Creating..." : "Create goal"}
            </Button>
          )}
        >
          <div className="fin-summary-metric">
            <span>Target</span>
            <strong>{form.targetAmount ? formatCurrency(form.targetAmount) : "Add an amount"}</strong>
          </div>
          <div className="fin-summary-metric">
            <span>Timeline</span>
            <strong>{form.durationValue ? `${form.durationValue} ${form.durationUnit}` : "Add a duration"}</strong>
          </div>
          <div className="plan-card fin-summary-card">
            <span className="plan-label">Auto-calculated plan</span>
            <strong className="plan-value">
              {suggestedPlan ? `Save ${formatCurrency(suggestedPlan.amount)}/${suggestedPlan.label}` : "Add target and duration"}
            </strong>
          </div>
        </ConfirmSummaryCard>
        </FormPageLayout>
      </form>
    </Layout>
  );
}
