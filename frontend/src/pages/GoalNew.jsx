import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import Input from "../components/Input.jsx";
import Layout from "../components/Layout.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
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

  function applyTemplate(template) {
    setForm({ name: template.name, targetAmount: String(template.targetAmount), durationValue: template.durationValue, durationUnit: template.durationUnit });
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
      await createGoal({ name: form.name.trim(), targetAmount: toAmount(form.targetAmount), duration: `${form.durationValue} ${form.durationUnit}` });
      navigate("/goals");
    } catch (error) {
      setFeedback({ type: "error", message: error.response?.data?.message || error.message || "We could not create the goal." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout eyebrow="New Goal" title="Create a savings goal" subtitle="Use a template or build a custom target with a simple savings plan.">
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <section className="content-grid-main">
        <div className="content-main-column page-stack">
          <Card>
            <SectionHeader title="Goal templates" subtitle="Start with a common savings target and tweak the details to match your plan." />
            <div className="responsive-grid">
              {goalTemplates.map((template) => (
                <button key={template.name} type="button" className="template-card" onClick={() => applyTemplate(template)}>
                  <span className="template-title">{template.name}</span>
                  <span className="template-copy">{formatCurrency(template.targetAmount)} target</span>
                  <span className="template-copy">{template.durationValue} {template.durationUnit}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="content-side-column">
          <Card>
            <SectionHeader title="Goal details" subtitle="Minimal fields, clear targets, and a plan you can act on." />
            <form className="page-stack-sm" onSubmit={handleSubmit}>
              <Input label="Goal name" type="text" placeholder="Emergency fund" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              <Input label="Target amount" type="number" min="1" placeholder="50000" value={form.targetAmount} onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))} />
              <div className="form-grid-two">
                <Input label="Duration" type="number" min="1" placeholder="90" value={form.durationValue} onChange={(event) => setForm((current) => ({ ...current, durationValue: event.target.value }))} />
                <Input as="select" label="Unit" value={form.durationUnit} onChange={(event) => setForm((current) => ({ ...current, durationUnit: event.target.value }))}>
                  {durationUnits.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Input>
              </div>
              <div className="plan-card">
                <span className="plan-label">Auto-calculated plan</span>
                <strong className="plan-value">{suggestedPlan ? `Save ${formatCurrency(suggestedPlan.amount)}/${suggestedPlan.label}` : "Add target and duration"}</strong>
                <span className="plan-copy">We calculate a simple plan so you know what to set aside each period.</span>
              </div>
              <Button type="submit" fullWidth disabled={createDisabled}>{isSubmitting ? "Creating..." : "Create goal"}</Button>
            </form>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
