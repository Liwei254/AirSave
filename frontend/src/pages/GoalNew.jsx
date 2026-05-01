import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { createGoal, getActiveGoal, getCurrentUser } from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { toAmount } from "../utils/savings";

const amountFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const unitOptions = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
];

const templates = [
  { id: "emergency", name: "Emergency Fund", displayName: "Emergency fund", targetAmount: 50000, duration: 90, unit: "days", tone: "emergency" },
  { id: "rent", name: "Rent", displayName: "Rent", targetAmount: 25000, duration: 4, unit: "weeks", tone: "rent" },
  { id: "school", name: "School Fees", displayName: "School Fees", targetAmount: 80000, duration: 6, unit: "months", tone: "school" },
  { id: "custom", name: "Custom Goal", displayName: "Custom Goal", targetAmount: "", duration: "", unit: "months", tone: "custom" },
];

function formatKsh(value) {
  return `Ksh ${amountFormatter.format(Math.max(0, Number(value || 0)))}`;
}

function parseNumericInput(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  return digitsOnly ? String(Number(digitsOnly)) : "";
}

function getTimelineDays(duration, unit) {
  const numericDuration = toAmount(duration);
  if (!numericDuration) return 0;
  if (unit === "weeks") return numericDuration * 7;
  if (unit === "months") return numericDuration * 30;
  return numericDuration;
}

function addDuration(date, duration, unit) {
  const next = new Date(date);
  const numericDuration = toAmount(duration);
  if (!numericDuration) return next;

  if (unit === "months") {
    next.setMonth(next.getMonth() + numericDuration);
    return next;
  }

  next.setDate(next.getDate() + getTimelineDays(numericDuration, unit));
  return next;
}

function CheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="m5 12 4 4 10-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="6" y="10" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <path d="m15.4 8.6 4.2-4.2M17.3 4.2h2.5v2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 3 19 6v5.2c0 4.3-2.8 7.9-7 9.8-4.2-1.9-7-5.5-7-9.8V6l7-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9.2 12 1.8 1.8 3.9-4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TemplateIcon({ tone }) {
  if (tone === "emergency") return <ShieldIcon className="goal-template-icon" />;
  if (tone === "rent") {
    return (
      <svg viewBox="0 0 24 24" className="goal-template-icon" aria-hidden="true">
        <path d="m4 10 8-6 8 6v10H4V10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 20v-6h4v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "school") {
    return (
      <svg viewBox="0 0 24 24" className="goal-template-icon" aria-hidden="true">
        <path d="m3 8.5 9-4 9 4-9 4-9-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M7 11v4.2c0 1.5 2.2 2.8 5 2.8s5-1.3 5-2.8V11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (tone === "custom") {
    return (
      <svg viewBox="0 0 24 24" className="goal-template-icon" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return <TargetIcon className="goal-template-icon" />;
}

function FieldIcon({ type }) {
  if (type === "name") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 16.5 8.6-8.6 3.5 3.5-8.6 8.6H4v-3.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m14.5 6 1.1-1.1a2 2 0 0 1 2.8 2.8l-1.1 1.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "amount") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 6h10l2 5-7 10-7-10 2-5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 9v6M9.7 11h3.1a1.7 1.7 0 1 1 0 3.4h-1.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SummaryIllustration() {
  return (
    <div className="goal-summary-illustration" aria-hidden="true">
      <div className="goal-summary-target">
        <div />
        <div />
        <div />
      </div>
      <div className="goal-summary-arrow" />
      <div className="goal-summary-leaves goal-summary-leaves-left" />
      <div className="goal-summary-leaves goal-summary-leaves-right" />
      <div className="goal-summary-coins">
        <span />
        <span />
        <span />
      </div>
      <span className="goal-summary-spark goal-summary-spark-one">+</span>
      <span className="goal-summary-spark goal-summary-spark-two">+</span>
    </div>
  );
}

function BenefitsBar() {
  const items = [
    {
      title: "Secure & private",
      copy: "Your goal is safe with bank-level security.",
      tone: "secure",
      icon: <ShieldIcon />,
    },
    {
      title: "Auto-plan",
      copy: "We'll help you stay on track automatically.",
      tone: "plan",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19h16M6 16v-4M11 16V8M16 16v-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="m5 10 5-4 4 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Smart reminders",
      copy: "Get reminders so you never miss a save.",
      tone: "reminder",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <section className="goal-benefits-bar" aria-label="Goal benefits">
      {items.map((item, index) => (
        <div className="goal-benefit-item" key={item.title}>
          <span className={["goal-benefit-icon", `goal-benefit-icon-${item.tone}`].join(" ")}>{item.icon}</span>
          <span>
            <strong>{item.title}</strong>
            <small>{item.copy}</small>
          </span>
          {index < items.length - 1 ? <span className="goal-benefit-divider" aria-hidden="true" /> : null}
        </div>
      ))}
    </section>
  );
}

export default function GoalNew() {
  const navigate = useNavigate();
  const [activeGoal, setActiveGoal] = useState(null);
  const [isLoadingSetup, setIsLoadingSetup] = useState(true);
  const [roundUpSetupComplete, setRoundUpSetupComplete] = useState(true);
  const [selectedRoundUpRule, setSelectedRoundUpRule] = useState(50);
  const [selectedTemplateId, setSelectedTemplateId] = useState("emergency");
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || templates[0];
  const [form, setForm] = useState({
    name: selectedTemplate.displayName,
    targetAmount: String(selectedTemplate.targetAmount),
    durationValue: String(selectedTemplate.duration),
    durationUnit: selectedTemplate.unit,
  });
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSetupState() {
      try {
        const [goalData, userData] = await Promise.all([getActiveGoal(), getCurrentUser()]);
        if (!isMounted) return;

        setActiveGoal(goalData);
        setSelectedRoundUpRule(userData?.roundUpRule || 50);
        setRoundUpSetupComplete(Boolean(userData?.roundUpRule));
      } catch {
        if (isMounted) {
          setRoundUpSetupComplete(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSetup(false);
        }
      }
    }

    loadSetupState();
    return () => {
      isMounted = false;
    };
  }, []);

  const targetAmount = toAmount(form.targetAmount);
  const durationValue = toAmount(form.durationValue);
  const timelineDays = getTimelineDays(durationValue, form.durationUnit);
  const dailyTarget = targetAmount && timelineDays ? Math.ceil(targetAmount / timelineDays) : 0;
  const startDate = useMemo(() => new Date(), []);
  const expectedCompletionDate = useMemo(
    () => addDuration(startDate, durationValue, form.durationUnit),
    [durationValue, form.durationUnit, startDate]
  );
  const timelineLabel = durationValue
    ? `${durationValue} ${durationValue === 1 ? form.durationUnit.replace(/s$/, "") : form.durationUnit}`
    : `0 ${form.durationUnit}`;
  const goalNameError = submitted && !form.name.trim() ? "Goal name is required." : "";
  const targetError = submitted && targetAmount <= 0 ? "Enter a target amount greater than zero." : "";
  const durationError = submitted && durationValue <= 0 ? "Enter a duration greater than zero." : "";
  const hasActiveGoal = Boolean(activeGoal);
  const canCreate =
    form.name.trim() &&
    targetAmount > 0 &&
    durationValue > 0 &&
    form.durationUnit &&
    roundUpSetupComplete &&
    !hasActiveGoal &&
    !isLoadingSetup &&
    !isSubmitting;

  function applyTemplate(template) {
    setSelectedTemplateId(template.id);
    if (template.id === "custom") {
      setForm((current) => ({
        ...current,
        name: current.name && !templates.some((item) => item.displayName === current.name) ? current.name : "",
        targetAmount: "",
        durationValue: "",
        durationUnit: "months",
      }));
      return;
    }

    setForm({
      name: template.displayName,
      targetAmount: String(template.targetAmount),
      durationValue: String(template.duration),
      durationUnit: template.unit,
    });
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    setSubmitted(true);

    if (!canCreate) {
      setToast({
        type: "error",
        message: hasActiveGoal
          ? "You already have an active goal. Complete or close it before creating another."
          : "Complete all goal details to continue.",
      });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    try {
      await createGoal({
        name: form.name.trim(),
        targetAmount,
        duration: `${durationValue} ${form.durationUnit}`,
        durationUnit: form.durationUnit,
        template: selectedTemplate.name,
        savedAmount: 0,
        status: "active",
        startDate: startDate.toISOString(),
        expectedCompletionDate: expectedCompletionDate.toISOString(),
        roundUpRule: selectedRoundUpRule,
      });
      triggerDashboardRefresh();
      setToast({ type: "success", message: "Goal created successfully." });
      navigate("/save");
    } catch (error) {
      setToast({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not create the goal.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout shellClassName="goal-new-shell">
      {toast ? (
        <div className={["goal-toast", toast.type === "success" ? "goal-toast-success" : "goal-toast-error"].join(" ")}>
          <strong>{toast.type === "success" ? "Success" : "Error"}</strong>
          <span>{toast.message}</span>
        </div>
      ) : null}

      {!isLoadingSetup && !roundUpSetupComplete ? (
        <div className="roundup-modal-backdrop" role="presentation">
          <section className="roundup-modal" role="dialog" aria-modal="true" aria-labelledby="roundupSetupTitle">
            <span className="premium-kicker">FIRST GOAL SETUP</span>
            <h2 id="roundupSetupTitle">Choose how AirSave should save for you</h2>
            <p>AirSave will round every eligible purchase and move the difference into your savings wallet.</p>
            <div className="roundup-modal-actions">
              {[10, 50, 100].map((rule) => (
                <button
                  key={rule}
                  type="button"
                  className={selectedRoundUpRule === rule ? "roundup-modal-rule roundup-modal-rule-active" : "roundup-modal-rule"}
                  onClick={() => {
                    setSelectedRoundUpRule(rule);
                    setRoundUpSetupComplete(true);
                  }}
                >
                  <span>Round to</span>
                  <strong>{rule}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {hasActiveGoal ? (
        <section className="my-goal-empty">
          <span className="premium-kicker">My Goal</span>
          <h1>You already have an active goal.</h1>
          <p>Complete or close your current goal before creating another one.</p>
          <button type="button" onClick={() => navigate("/save")}>
            View current goal
          </button>
        </section>
      ) : (
      <div className="goal-new-page">
        <form className="goal-new-grid" onSubmit={handleSubmit}>
          <section className="goal-form-card" aria-labelledby="goalNewTitle">
            <div className="goal-form-header">
              <span className="goal-form-header-icon">
                <TargetIcon />
              </span>
              <div>
                <h1 id="goalNewTitle">Create your savings goal</h1>
                <p>Set one clear target and AirSave will help you reach it.</p>
              </div>
            </div>

            <section className="goal-form-section">
              <h2>Choose a template</h2>
              <div className="goal-template-grid">
                {templates.map((template) => {
                  const selected = template.id === selectedTemplateId;
                  return (
                    <button
                      type="button"
                      className={["goal-template-card", selected ? "goal-template-card-selected" : "", `goal-template-${template.tone}`].filter(Boolean).join(" ")}
                      onClick={() => applyTemplate(template)}
                      aria-pressed={selected}
                      key={template.id}
                    >
                      <span className="goal-template-icon-wrap">
                        <TemplateIcon tone={template.tone} />
                      </span>
                      <strong>{template.name}</strong>
                      {selected ? (
                        <span className="goal-template-check">
                          <CheckIcon />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="goal-form-section goal-details-section">
              <h2>Goal details</h2>
              <div className="goal-details-grid">
                <label className="goal-field">
                  <span>Goal name</span>
                  <span className={["goal-input-shell", goalNameError ? "goal-input-shell-error" : ""].filter(Boolean).join(" ")}>
                    <span className="goal-field-icon"><FieldIcon type="name" /></span>
                    <input
                      type="text"
                      placeholder="Emergency fund"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </span>
                  {goalNameError ? <small className="goal-field-error">{goalNameError}</small> : null}
                </label>

                <label className="goal-field">
                  <span>Target amount</span>
                  <span className={["goal-input-shell goal-amount-shell", targetError ? "goal-input-shell-error" : ""].filter(Boolean).join(" ")}>
                    <span className="goal-field-icon"><FieldIcon type="amount" /></span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="50,000"
                      value={form.targetAmount ? amountFormatter.format(targetAmount) : ""}
                      onChange={(event) => setForm((current) => ({ ...current, targetAmount: parseNumericInput(event.target.value) }))}
                    />
                    <span className="goal-amount-suffix">Ksh</span>
                  </span>
                  {targetError ? <small className="goal-field-error">{targetError}</small> : null}
                </label>

                <label className="goal-field">
                  <span>Duration</span>
                  <span className={["goal-input-shell", durationError ? "goal-input-shell-error" : ""].filter(Boolean).join(" ")}>
                    <span className="goal-field-icon"><FieldIcon type="duration" /></span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="90"
                      value={form.durationValue ? amountFormatter.format(durationValue) : ""}
                      onChange={(event) => setForm((current) => ({ ...current, durationValue: parseNumericInput(event.target.value) }))}
                    />
                  </span>
                  <small>How long do you want to save?</small>
                  {durationError ? <small className="goal-field-error">{durationError}</small> : null}
                </label>

                <div className="goal-field">
                  <span>Unit</span>
                  <div className="goal-unit-row">
                    {unitOptions.map((unit) => (
                      <button
                        type="button"
                        className={form.durationUnit === unit.value ? "goal-unit-active" : ""}
                        onClick={() => setForm((current) => ({ ...current, durationUnit: unit.value }))}
                        aria-pressed={form.durationUnit === unit.value}
                        key={unit.value}
                      >
                        {unit.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="goal-track-note">
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 19h16M6 16v-4M11 16V8M16 16v-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="m5 10 5-4 4 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <strong>You're on track!</strong>
                <p>You need to save {formatKsh(dailyTarget)} per day to reach your goal.</p>
              </div>
            </div>

            <div className="goal-privacy-note">
              <LockIcon />
              Your goal is private and only visible to you.
            </div>
          </section>

          <aside className="goal-summary-card" aria-label="Goal summary">
            <div className="goal-summary-top">
              <span>GOAL SUMMARY</span>
              <h2>{form.name.trim() || "Custom Goal"}</h2>
              <small>Target amount</small>
              <strong>{formatKsh(targetAmount)}</strong>
            </div>
            <SummaryIllustration />

            <div className="goal-summary-panel">
              <div className="goal-summary-row">
                <span>Timeline</span>
                <strong>{timelineLabel}</strong>
              </div>
              <div className="goal-summary-row">
                <span>Daily target</span>
                <strong>{formatKsh(dailyTarget)}</strong>
              </div>
              <div className="goal-summary-row">
                <span>Start date</span>
                <strong>{dateFormatter.format(startDate)}</strong>
              </div>
              <div className="goal-summary-row">
                <span>Expected completion</span>
                <strong>{dateFormatter.format(expectedCompletionDate)}</strong>
              </div>
            </div>

            <div className="goal-progress-panel">
              <div className="goal-progress-head">
                <span>Progress</span>
                <strong>0%</strong>
              </div>
              <div className="goal-progress-track"><span /></div>
              <p>Ksh 0 saved</p>

              <div className="goal-tip-box">
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-.7.7-1 1.5-1 2H9c0-.5-.3-1.3-1-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <strong>Stay consistent</strong>
                  <p>Small daily savings go a long way. You've got this!</p>
                </div>
              </div>
            </div>

            <button type="submit" className="goal-create-button" disabled={!canCreate}>
              {isSubmitting ? <span className="spinner goal-create-spinner" aria-hidden="true" /> : <TargetIcon />}
              {isSubmitting ? "Creating..." : "Create goal"}
            </button>
            <button type="button" className="goal-cancel-button" onClick={() => navigate("/save")}>Cancel</button>
          </aside>
        </form>

        <BenefitsBar />
      </div>
      )}
    </Layout>
  );
}
