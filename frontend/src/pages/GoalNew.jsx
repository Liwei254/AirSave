import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { createGoal } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { durationUnits, goalTemplates, getSuggestedPlan, toAmount } from "../utils/savings";

const initialForm = {
  name: "",
  targetAmount: "",
  durationValue: "",
  durationUnit: "days",
};

export default function GoalNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestedPlan = getSuggestedPlan(form.targetAmount, form.durationValue, form.durationUnit);
  const createDisabled = !form.name.trim() || toAmount(form.targetAmount) <= 0 || toAmount(form.durationValue) <= 0 || isSubmitting;

  function applyTemplate(template) {
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
    <Layout
      eyebrow="New Goal"
      title="Create a savings goal"
      subtitle="Pick a template or create a custom target with a clear daily, weekly, or monthly plan."
      shellClassName="savings-shell"
    >
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <section className="goal-new-layout">
        <article className="app-card savings-card">
          <div className="card-header savings-card-header">
            <div>
              <h2 className="card-title">Goal templates</h2>
              <p className="card-subtitle">Start with a common savings target and adjust it to fit your plan.</p>
            </div>
          </div>

          <div className="goal-template-grid">
            {goalTemplates.map((template) => (
              <button key={template.name} type="button" className="goal-template-button" onClick={() => applyTemplate(template)}>
                <span className="goal-template-name">{template.name}</span>
                <span className="goal-template-meta">
                  {formatCurrency(template.targetAmount)} target · {template.durationValue} {template.durationUnit}
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="app-card savings-card">
          <div className="card-header savings-card-header">
            <div>
              <h2 className="card-title">Goal details</h2>
              <p className="card-subtitle">Keep it simple: name, target amount, and how long you want to take.</p>
            </div>
          </div>

          <form className="goal-create-form" onSubmit={handleSubmit}>
            <label className="field-group">
              <span className="field-label">Goal name</span>
              <input
                className="app-input"
                type="text"
                placeholder="Emergency fund"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label className="field-group">
              <span className="field-label">Target amount</span>
              <input
                className="app-input"
                type="number"
                min="1"
                placeholder="50000"
                value={form.targetAmount}
                onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))}
              />
            </label>

            <div className="goal-duration-grid">
              <label className="field-group">
                <span className="field-label">Duration</span>
                <input
                  className="app-input"
                  type="number"
                  min="1"
                  placeholder="90"
                  value={form.durationValue}
                  onChange={(event) => setForm((current) => ({ ...current, durationValue: event.target.value }))}
                />
              </label>

              <label className="field-group">
                <span className="field-label">Unit</span>
                <select
                  className="app-select"
                  value={form.durationUnit}
                  onChange={(event) => setForm((current) => ({ ...current, durationUnit: event.target.value }))}
                >
                  {durationUnits.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="goal-plan-card">
              <span className="goal-plan-label">Savings plan</span>
              <strong className="goal-plan-value">
                {suggestedPlan ? `Save ${formatCurrency(suggestedPlan.amount)}/${suggestedPlan.label}` : "Add target and duration"}
              </strong>
              <span className="goal-plan-hint">We calculate a simple plan so you know what to set aside each period.</span>
            </div>

            <button className="app-button app-button-primary" type="submit" disabled={createDisabled}>
              {isSubmitting ? "Creating..." : "Create goal"}
            </button>
          </form>
        </article>
      </section>
    </Layout>
  );
}

