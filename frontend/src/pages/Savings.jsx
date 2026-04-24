import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import {
  createGoal,
  getGoals,
  getPaymentStatus,
  getSavingsActivity,
  getWallet,
  initiatePayment,
} from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { formatCurrency, formatDate } from "../utils/formatters";

const roundingOptions = [
  { value: 10, label: "Round to 10" },
  { value: 50, label: "Round to 50" },
  { value: 100, label: "Round to 100" },
];

const quickAddOptions = [50, 100, 500];
const activityFilters = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];
const goalTemplates = [
  { name: "Emergency Fund", amount: 30000, durationValue: "6", durationUnit: "months" },
  { name: "Rent", amount: 18000, durationValue: "1", durationUnit: "month" },
  { name: "School Fees", amount: 45000, durationValue: "9", durationUnit: "months" },
];
const durationUnits = [
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
];
const phonePattern = /^(0\d{9}|\+254\d{9}|254\d{9})$/;
const recentPhoneStorageKey = "airsave:last-phone";
const recentGoalStorageKey = "airsave:last-goal";

function sortActivityByNewest(activityItems) {
  return [...(activityItems || [])].sort(
    (left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0)
  );
}

function toAmount(value) {
  return Number(value || 0);
}

function getProgress(goal) {
  const targetAmount = toAmount(goal?.targetAmount);
  if (!targetAmount) return 0;
  return Math.min(100, Math.round((toAmount(goal?.savedAmount) / targetAmount) * 100));
}

function getRemaining(goal) {
  return Math.max(0, toAmount(goal?.targetAmount) - toAmount(goal?.savedAmount));
}

function normalizeStatus(status) {
  if (status === "confirmed") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

function getActivityDate(item) {
  return new Date(item?.date || item?.createdAt || 0);
}

function isWithinFilter(item, filter) {
  const itemDate = getActivityDate(item);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === "today") {
    return itemDate >= startOfToday;
  }

  if (filter === "week") {
    const day = startOfToday.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - diff);
    return itemDate >= startOfWeek;
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return itemDate >= startOfMonth;
}

function getFilterLabel(filter) {
  if (filter === "today") return "today";
  if (filter === "week") return "this week";
  return "this month";
}

function getSuggestedPeriodicAmount(targetAmount, durationValue, durationUnit) {
  const numericTarget = toAmount(targetAmount);
  const numericDuration = toAmount(durationValue);

  if (!numericTarget || !numericDuration) {
    return null;
  }

  if (durationUnit === "weeks") {
    return {
      amount: Math.ceil(numericTarget / numericDuration),
      label: "weekly",
    };
  }

  return {
    amount: Math.ceil(numericTarget / numericDuration),
    label: "monthly",
  };
}

function getEstimatedCompletion(goal, weeklySavingsRate) {
  const remaining = getRemaining(goal);
  if (!remaining || weeklySavingsRate <= 0) {
    return "Add consistent savings to estimate completion time.";
  }

  const weeksRemaining = Math.ceil(remaining / weeklySavingsRate);
  if (weeksRemaining <= 4) {
    return `At your current pace, you could reach this in about ${weeksRemaining} week${weeksRemaining === 1 ? "" : "s"}.`;
  }

  const monthsRemaining = Math.ceil(weeksRemaining / 4);
  return `At your current pace, you could reach this in about ${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"}.`;
}

function getGoalMotivation(goal) {
  const remaining = getRemaining(goal);
  if (!remaining) {
    return "Goal completed. Keep the momentum going.";
  }

  return `You are ${formatCurrency(remaining)} away from ${goal.name}.`;
}

function getMostRecentlyUsedGoal(activeGoals, activityItems) {
  const storedGoalId = localStorage.getItem(recentGoalStorageKey);
  if (storedGoalId && activeGoals.some((goal) => goal._id === storedGoalId)) {
    return storedGoalId;
  }

  const latestGoalMatch = activityItems.find((item) =>
    activeGoals.some(
      (goal) =>
        goal._id === item.goalId ||
        goal._id === item.goal?._id ||
        goal.name?.toLowerCase() === item.goalName?.toLowerCase()
    )
  );

  if (!latestGoalMatch) {
    return activeGoals[0]?._id || "";
  }

  const matchedGoal = activeGoals.find(
    (goal) =>
      goal._id === latestGoalMatch.goalId ||
      goal._id === latestGoalMatch.goal?._id ||
      goal.name?.toLowerCase() === latestGoalMatch.goalName?.toLowerCase()
  );

  return matchedGoal?._id || activeGoals[0]?._id || "";
}

function Card({ className = "", children, sectionRef }) {
  return (
    <article ref={sectionRef} className={`app-card savings-card ${className}`.trim()}>
      {children}
    </article>
  );
}

function Button({ className = "", variant = "primary", children, ...props }) {
  return (
    <button
      className={`app-button ${variant === "primary" ? "app-button-primary" : "app-button-secondary"} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

function Input({ label, helper, error, className = "", ...props }) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <input className={`app-input ${className}`.trim()} {...props} />
      {helper ? <span className="helper-text">{helper}</span> : null}
      {error ? <span className="helper-text savings-error-text">{error}</span> : null}
    </label>
  );
}

function Select({ label, className = "", children, ...props }) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <select className={`app-select ${className}`.trim()} {...props}>
        {children}
      </select>
    </label>
  );
}

function ProgressBar({ value, completed }) {
  return (
    <div className="savings-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
      <div
        className={`savings-progress-fill ${completed ? "savings-progress-fill-complete" : ""}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function SaveStep({ number, title, active, complete }) {
  return (
    <div className={`save-step ${active ? "save-step-active" : ""} ${complete ? "save-step-complete" : ""}`}>
      <span className="save-step-number">{complete ? "OK" : number}</span>
      <div className="save-step-title">{title}</div>
    </div>
  );
}

function GoalTemplateButton({ template, onSelect }) {
  return (
    <button className="goal-template-button" type="button" onClick={() => onSelect(template)}>
      <span className="goal-template-name">{template.name}</span>
      <span className="goal-template-meta">
        {formatCurrency(template.amount)} target | {template.durationValue} {template.durationUnit}
      </span>
    </button>
  );
}

function GoalProgressCard({ goal, selected, onSelect, weeklySavingsRate }) {
  const progress = getProgress(goal);
  const remaining = getRemaining(goal);

  return (
    <button
      type="button"
      className={`goal-progress-card ${selected ? "goal-progress-card-selected" : ""}`}
      onClick={() => onSelect(goal._id)}
    >
      <div className="goal-progress-top">
        <div>
          <div className="goal-progress-name">{goal.name}</div>
          <div className="goal-progress-meta">
            Saved {formatCurrency(goal.savedAmount)} of {formatCurrency(goal.targetAmount)}
          </div>
        </div>
        <span className={`badge ${goal.status === "completed" ? "badge-success" : "badge-neutral"}`}>
          {goal.status || "active"}
        </span>
      </div>

      <ProgressBar value={progress} completed={goal.status === "completed"} />

      <div className="goal-progress-stats">
        <span>{progress}% complete</span>
        <span>{formatCurrency(remaining)} remaining</span>
      </div>

      <p className="goal-progress-motivation">{getGoalMotivation(goal)}</p>
      <p className="goal-progress-estimate">{getEstimatedCompletion(goal, weeklySavingsRate)}</p>
    </button>
  );
}

function SummaryMetric({ label, value, hint, accent = "default" }) {
  return (
    <div className={`summary-metric summary-metric-${accent}`}>
      <span className="summary-metric-label">{label}</span>
      <strong className="summary-metric-value">{value}</strong>
      <span className="summary-metric-hint">{hint}</span>
    </div>
  );
}

function ActivityFilterButton({ active, onClick, children }) {
  return (
    <button type="button" className={`activity-filter ${active ? "activity-filter-active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function ActivityTable({ items }) {
  if (!items.length) {
    return <div className="empty-state">No savings activity found for this range.</div>;
  }

  return (
    <div className="activity-table-wrap">
      <table className="activity-table">
        <thead>
          <tr>
            <th>Goal</th>
            <th>Charged</th>
            <th>Saved</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id}>
              <td>
                <div className="activity-primary">{item.goalName || "Savings goal"}</div>
                <div className="activity-secondary">M-Pesa transfer</div>
              </td>
              <td>{formatCurrency(item.amount)}</td>
              <td className="activity-savings-cell">{formatCurrency(item.savings)}</td>
              <td>{formatDate(item.date)}</td>
              <td>
                <span className={`badge badge-${normalizeStatus(item.status)}`}>{item.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Savings() {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const saveSectionRef = useRef(null);
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [goalForm, setGoalForm] = useState({
    name: "",
    targetAmount: "",
    durationValue: "",
    durationUnit: "months",
  });
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [rule, setRule] = useState(10);
  const [activeStep, setActiveStep] = useState(1);
  const [activityFilter, setActivityFilter] = useState("week");
  const [isLoading, setIsLoading] = useState(true);
  const [isGoalSubmitting, setIsGoalSubmitting] = useState(false);
  const [isSaveSubmitting, setIsSaveSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");
  const [paymentRef, setPaymentRef] = useState(null);
  const [isRefreshingAfterPayment, setIsRefreshingAfterPayment] = useState(false);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status !== "completed"),
    [goals]
  );

  const confirmedActivity = useMemo(
    () => activity.filter((item) => item.status === "confirmed"),
    [activity]
  );

  const filteredActivity = useMemo(
    () => activity.filter((item) => isWithinFilter(item, activityFilter)),
    [activity, activityFilter]
  );

  const weeklyConfirmedActivity = useMemo(
    () => confirmedActivity.filter((item) => isWithinFilter(item, "week")),
    [confirmedActivity]
  );

  const weeklySavingsTotal = useMemo(
    () => weeklyConfirmedActivity.reduce((sum, item) => sum + toAmount(item.savings), 0),
    [weeklyConfirmedActivity]
  );

  const filteredSavingsTotal = useMemo(
    () => filteredActivity
      .filter((item) => item.status === "confirmed")
      .reduce((sum, item) => sum + toAmount(item.savings), 0),
    [filteredActivity]
  );

  const recentGoal = useMemo(
    () => activeGoals.find((goal) => goal._id === selectedGoal) || activeGoals[0] || null,
    [activeGoals, selectedGoal]
  );

  const weeklySavingsRate = useMemo(() => {
    if (!confirmedActivity.length) {
      return 0;
    }

    const newest = getActivityDate(confirmedActivity[0]);
    const oldest = getActivityDate(confirmedActivity[confirmedActivity.length - 1]);
    const spanDays = Math.max(7, Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24)) + 1);
    const totalSavings = confirmedActivity.reduce((sum, item) => sum + toAmount(item.savings), 0);
    return Math.max(0, Math.round((totalSavings / spanDays) * 7));
  }, [confirmedActivity]);

  const planSuggestion = useMemo(
    () =>
      getSuggestedPeriodicAmount(goalForm.targetAmount, goalForm.durationValue, goalForm.durationUnit),
    [goalForm.durationUnit, goalForm.durationValue, goalForm.targetAmount]
  );

  const trimmedPhone = phone.trim();
  const isPhoneValid = phonePattern.test(trimmedPhone);
  const phoneError =
    trimmedPhone && !isPhoneValid
      ? "Enter a valid phone number in the format 07XXXXXXXX or +254XXXXXXXXX."
      : "";

  const numericAmount = toAmount(amount);
  const rounded = amount ? Math.ceil(numericAmount / rule) * rule : 0;
  const savings = amount ? Math.max(0, rounded - numericAmount) : 0;
  const saveFlowReadyForPreview = Boolean(amount) && numericAmount > 0 && selectedGoal && trimmedPhone && isPhoneValid;
  const goalDurationLabel = goalForm.durationValue
    ? `${goalForm.durationValue} ${goalForm.durationUnit}`
    : "";
  const goalDisabled =
    !goalForm.name.trim() ||
    !goalForm.targetAmount ||
    toAmount(goalForm.targetAmount) <= 0 ||
    !goalForm.durationValue ||
    isGoalSubmitting;
  const saveDisabled =
    !amount ||
    numericAmount <= 0 ||
    !selectedGoal ||
    !trimmedPhone ||
    !isPhoneValid ||
    isSaveSubmitting ||
    isRefreshingAfterPayment;

  const loadDashboard = useCallback(async () => {
    const [walletData, goalsData, activityData] = await Promise.all([
      getWallet(),
      getGoals(),
      getSavingsActivity(),
    ]);

    if (!isMountedRef.current) {
      return;
    }

    const sortedActivity = sortActivityByNewest(activityData);
    const normalizedGoals = goalsData || [];

    setWallet(walletData);
    setGoals(normalizedGoals);
    setActivity(sortedActivity);
    setSelectedGoal((current) => {
      if (current && normalizedGoals.some((goal) => goal._id === current && goal.status !== "completed")) {
        return current;
      }

      return getMostRecentlyUsedGoal(
        normalizedGoals.filter((goal) => goal.status !== "completed"),
        sortedActivity
      );
    });
  }, []);

  async function handleCreateGoal(event) {
    event.preventDefault();

    if (goalDisabled) {
      setFeedback({ type: "error", message: "Complete all goal fields before creating a goal." });
      return;
    }

    setIsGoalSubmitting(true);
    setFeedback(null);

    try {
      await createGoal({
        name: goalForm.name.trim(),
        targetAmount: toAmount(goalForm.targetAmount),
        duration: goalDurationLabel,
      });

      await loadDashboard();
      triggerDashboardRefresh();
      setGoalForm({ name: "", targetAmount: "", durationValue: "", durationUnit: "months" });
      setFeedback({ type: "success", message: "Goal created successfully." });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Failed to create goal.",
      });
    } finally {
      setIsGoalSubmitting(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (saveDisabled) {
      if (!amount || numericAmount <= 0) {
        setFeedback({ type: "error", message: "Enter an amount greater than zero." });
      } else if (!selectedGoal) {
        setFeedback({ type: "error", message: "Select a goal before submitting payment." });
      } else if (!trimmedPhone) {
        setFeedback({ type: "error", message: "Phone number is required." });
      } else if (!isPhoneValid) {
        setFeedback({ type: "error", message: phoneError });
      }
      return;
    }

    setIsSaveSubmitting(true);
    setFeedback(null);

    try {
      const res = await initiatePayment({
        amount: numericAmount,
        rule,
        phone: trimmedPhone,
        goalId: selectedGoal,
      });

      localStorage.setItem(recentPhoneStorageKey, trimmedPhone);
      localStorage.setItem(recentGoalStorageKey, selectedGoal);

      await loadDashboard();
      triggerDashboardRefresh();
      setPaymentRef(res.paymentReference);
      setIsRefreshingAfterPayment(true);
      setAmount("");
      setActiveStep(1);
      setFeedback({
        type: "success",
        message: "STK push sent. Confirm the prompt on your phone to complete the save.",
      });
    } catch (err) {
      setPaymentRef(null);
      setIsRefreshingAfterPayment(false);
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Payment initiation failed.",
      });
    } finally {
      setIsSaveSubmitting(false);
    }
  }

  function handleQuickAdd(value) {
    const nextAmount = toAmount(amount) + value;
    setAmount(String(nextAmount));
    setActiveStep(2);
  }

  function handleChooseTemplate(template) {
    setGoalForm({
      name: template.name,
      targetAmount: String(template.amount),
      durationValue: template.durationValue,
      durationUnit: template.durationUnit,
    });
  }

  function handlePrimarySaveCta() {
    saveSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const storedPhone = localStorage.getItem(recentPhoneStorageKey);
    if (storedPhone) {
      setPhone(storedPhone);
    }
  }, []);

  useEffect(() => {
    if (!amount || numericAmount <= 0) {
      setActiveStep(1);
      return;
    }

    if (!selectedGoal) {
      setActiveStep(2);
      return;
    }

    setActiveStep(3);
  }, [amount, numericAmount, selectedGoal]);

  useEffect(() => {
    if (!paymentRef) {
      return undefined;
    }

    let isCancelled = false;

    async function trackPaymentStatus() {
      try {
        const payment = await getPaymentStatus(paymentRef);

        if (isCancelled || !isMountedRef.current) {
          return;
        }

        if (payment?.status === "confirmed" || payment?.status === "failed") {
          await loadDashboard();
          triggerDashboardRefresh();

          setPaymentRef(null);
          setIsRefreshingAfterPayment(false);
          setFeedback((current) =>
            current?.type === "success"
              ? {
                  ...current,
                  message:
                    payment.status === "confirmed"
                      ? "Save completed successfully. Your dashboard is updated."
                      : "The M-Pesa prompt was sent, but the payment did not complete.",
                }
              : current
          );
          return;
        }
      } catch {
        if (!isMountedRef.current || isCancelled) {
          return;
        }
      }

      window.setTimeout(trackPaymentStatus, 2000);
    }

    trackPaymentStatus();

    return () => {
      isCancelled = true;
    };
  }, [loadDashboard, paymentRef]);

  useEffect(() => {
    isMountedRef.current = true;

    async function initializePage() {
      try {
        await loadDashboard();
        if (isMountedRef.current) {
          setError("");
        }
      } catch (err) {
        if (!isMountedRef.current) {
          return;
        }

        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem("token");
          navigate("/");
          return;
        }

        setError(err.response?.data?.message || err.message || "We could not load your savings page.");
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    initializePage();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadDashboard, navigate]);

  return (
    <Layout
      eyebrow="Savings"
      title="Save faster with less friction"
      subtitle="Choose a goal, confirm one M-Pesa payment, and keep momentum with clear progress and weekly feedback."
      actions={
        <Button className="savings-hero-button" type="button" onClick={handlePrimarySaveCta}>
          Save Now
        </Button>
      }
      shellClassName="savings-shell"
    >
      {feedback ? (
        <div
          className={`feedback ${
            feedback.type === "success" ? "feedback-success savings-feedback-success" : "feedback-error"
          }`}
        >
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

      {!isLoading && wallet ? (
        <section className="savings-overview-grid">
          <Card className="savings-hero-card">
            <div className="savings-hero-copy">
              <span className="metric-label">Total Savings</span>
              <h2 className="savings-hero-value">{formatCurrency(wallet.balance)}</h2>
              <p className="savings-hero-text">
                {weeklySavingsTotal > 0
                  ? `You saved ${formatCurrency(weeklySavingsTotal)} this week. Keep the pace steady.`
                  : "Your next M-Pesa save will start building momentum this week."}
              </p>
            </div>

            <div className="savings-hero-metrics">
              <SummaryMetric
                label="Active goals"
                value={String(activeGoals.length)}
                hint={activeGoals.length ? "Goals ready for quick save" : "Create one to begin"}
                accent="cool"
              />
              <SummaryMetric
                label="This week"
                value={formatCurrency(weeklySavingsTotal)}
                hint="Confirmed savings so far"
                accent="success"
              />
              <SummaryMetric
                label="Transactions"
                value={String(wallet.transactionsCount || 0)}
                hint="Tracked in your wallet"
              />
            </div>
          </Card>
        </section>
      ) : null}

      <section className="savings-dashboard-grid">
        <div className="savings-main-column">
          <Card className="save-flow-card" sectionRef={saveSectionRef}>
            <div className="card-header savings-card-header">
              <div>
                <h2 className="card-title">Save to Goal</h2>
                <p className="card-subtitle">
                  The fastest path: amount first, goal next, then confirm the M-Pesa preview.
                </p>
              </div>
              <span className="status-chip">
                {recentGoal ? `Recent goal: ${recentGoal.name}` : "Create a goal to start saving"}
              </span>
            </div>

            <div className="save-step-row">
              <SaveStep number="1" title="Enter amount" active={activeStep === 1} complete={numericAmount > 0} />
              <SaveStep number="2" title="Select goal" active={activeStep === 2} complete={Boolean(selectedGoal)} />
              <SaveStep
                number="3"
                title="Review M-Pesa"
                active={activeStep === 3}
                complete={saveFlowReadyForPreview}
              />
            </div>

            <form className="save-flow-form" onSubmit={handleSave}>
              <div className="save-flow-grid">
                <Input
                  id="saveAmount"
                  label="Step 1: How much do you want to save?"
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  helper="Tap a quick amount or type a custom figure."
                />

                <div className="quick-add-group">
                  {quickAddOptions.map((quickAmount) => (
                    <button
                      key={quickAmount}
                      className="quick-add-button"
                      type="button"
                      onClick={() => handleQuickAdd(quickAmount)}
                    >
                      +{quickAmount}
                    </button>
                  ))}
                </div>

                <Select
                  id="saveGoal"
                  label="Step 2: Choose a goal"
                  value={selectedGoal}
                  onChange={(event) => setSelectedGoal(event.target.value)}
                >
                  <option value="" disabled>
                    Select a goal
                  </option>
                  {activeGoals.map((goal) => (
                    <option key={goal._id} value={goal._id}>
                      {goal.name} | {formatCurrency(goal.savedAmount)} / {formatCurrency(goal.targetAmount)}
                    </option>
                  ))}
                </Select>

                <Input
                  id="savePhone"
                  label="Phone number"
                  type="tel"
                  placeholder="07XXXXXXXX or +254XXXXXXXXX"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  helper="We auto-fill your most recently used number."
                  error={phoneError}
                />

                <Select
                  id="roundingRule"
                  label="Round-up rule"
                  value={rule}
                  onChange={(event) => setRule(Number(event.target.value))}
                >
                  {roundingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mpesa-preview-card">
                <div className="mpesa-preview-header">
                  <div>
                    <h3 className="mpesa-preview-title">Step 3: M-Pesa preview</h3>
                    <p className="mpesa-preview-subtitle">Confirm what is charged and what lands in savings.</p>
                  </div>
                  <span className="badge badge-neutral">{recentGoal?.name || "No goal selected"}</span>
                </div>

                <div className="mpesa-preview-values">
                  <div className="mpesa-preview-total">
                    <span>Total charged amount</span>
                    <strong>{formatCurrency(rounded)}</strong>
                  </div>
                  <div className="mpesa-preview-savings">
                    <span>Actual savings amount</span>
                    <strong>{formatCurrency(savings)}</strong>
                  </div>
                </div>

                <p className="mpesa-preview-note">Includes transaction fee based on your selected round-up rule.</p>
              </div>

              <div className="save-flow-actions">
                <Button className="save-submit-button" type="submit" disabled={saveDisabled}>
                  {isSaveSubmitting || isRefreshingAfterPayment ? "Processing..." : "Save Now"}
                </Button>
                <span className="helper-text">
                  {saveFlowReadyForPreview
                    ? `Ready to save into ${recentGoal?.name || "your goal"}`
                    : "Complete the amount, goal, and phone fields to continue."}
                </span>
              </div>
            </form>
          </Card>

          <Card>
            <div className="card-header savings-card-header">
              <div>
                <h2 className="card-title">Goals</h2>
                <p className="card-subtitle">
                  Track progress, see what remains, and focus your next save on the right goal.
                </p>
              </div>
              {!isLoading ? <span className="status-chip">{goals.length} total</span> : null}
            </div>

            {isLoading ? (
              <div className="loading-panel">
                <span className="spinner spinner-dark" aria-hidden="true" />
                <span>Loading goals...</span>
              </div>
            ) : activeGoals.length ? (
              <div className="goal-progress-grid">
                {activeGoals.map((goal) => (
                  <GoalProgressCard
                    key={goal._id}
                    goal={goal}
                    selected={goal._id === selectedGoal}
                    onSelect={setSelectedGoal}
                    weeklySavingsRate={weeklySavingsRate}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">No active goals yet. Create one below to start saving.</div>
            )}
          </Card>

          <Card>
            <div className="card-header savings-card-header">
              <div>
                <h2 className="card-title">Activity</h2>
                <p className="card-subtitle">Review recent savings, filter by time, and spot your momentum quickly.</p>
              </div>
              <div className="activity-filter-row">
                {activityFilters.map((filterOption) => (
                  <ActivityFilterButton
                    key={filterOption.value}
                    active={activityFilter === filterOption.value}
                    onClick={() => setActivityFilter(filterOption.value)}
                  >
                    {filterOption.label}
                  </ActivityFilterButton>
                ))}
              </div>
            </div>

            <div className="activity-summary-banner">
              You saved {formatCurrency(filteredSavingsTotal)} {getFilterLabel(activityFilter)}.
            </div>

            {isLoading ? (
              <div className="loading-panel">
                <span className="spinner spinner-dark" aria-hidden="true" />
                <span>Loading activity...</span>
              </div>
            ) : (
              <ActivityTable items={filteredActivity} />
            )}
          </Card>
        </div>

        <div className="savings-side-column">
          <Card>
            <div className="card-header savings-card-header">
              <div>
                <h2 className="card-title">Create Goal</h2>
                <p className="card-subtitle">Start with a template or create a custom target in a few fields.</p>
              </div>
            </div>

            <div className="goal-template-grid">
              {goalTemplates.map((template) => (
                <GoalTemplateButton key={template.name} template={template} onSelect={handleChooseTemplate} />
              ))}
            </div>

            <form className="goal-create-form" onSubmit={handleCreateGoal}>
              <Input
                id="goalName"
                label="Goal name"
                type="text"
                placeholder="Emergency fund"
                value={goalForm.name}
                onChange={(event) =>
                  setGoalForm((current) => ({ ...current, name: event.target.value }))
                }
              />

              <Input
                id="goalTargetAmount"
                label="Target amount"
                type="number"
                min="1"
                placeholder="50000"
                value={goalForm.targetAmount}
                onChange={(event) =>
                  setGoalForm((current) => ({ ...current, targetAmount: event.target.value }))
                }
              />

              <div className="goal-duration-grid">
                <Input
                  id="goalDurationValue"
                  label="Duration"
                  type="number"
                  min="1"
                  placeholder="6"
                  value={goalForm.durationValue}
                  onChange={(event) =>
                    setGoalForm((current) => ({ ...current, durationValue: event.target.value }))
                  }
                />

                <Select
                  id="goalDurationUnit"
                  label="Unit"
                  value={goalForm.durationUnit}
                  onChange={(event) =>
                    setGoalForm((current) => ({ ...current, durationUnit: event.target.value }))
                  }
                >
                  {durationUnits.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="goal-plan-card">
                <span className="goal-plan-label">Suggested plan</span>
                <strong className="goal-plan-value">
                  {planSuggestion
                    ? `${formatCurrency(planSuggestion.amount)} ${planSuggestion.label}`
                    : "Add target and duration to see a plan"}
                </strong>
                <span className="goal-plan-hint">
                  We estimate the amount you need to set aside each period to hit your target on time.
                </span>
              </div>

              <Button type="submit" disabled={goalDisabled}>
                {isGoalSubmitting ? "Creating..." : "Create goal"}
              </Button>
            </form>
          </Card>

          <Card>
            <div className="card-header savings-card-header">
              <div>
                <h2 className="card-title">Selected Goal Focus</h2>
                <p className="card-subtitle">A focused summary to help you decide where your next save should go.</p>
              </div>
            </div>

            {recentGoal ? (
              <div className="selected-goal-focus">
                <div className="selected-goal-focus-top">
                  <h3>{recentGoal.name}</h3>
                  <span className="badge badge-success">{getProgress(recentGoal)}%</span>
                </div>
                <ProgressBar value={getProgress(recentGoal)} completed={recentGoal.status === "completed"} />
                <div className="selected-goal-focus-stats">
                  <SummaryMetric
                    label="Saved"
                    value={formatCurrency(recentGoal.savedAmount)}
                    hint="Current balance in this goal"
                    accent="success"
                  />
                  <SummaryMetric
                    label="Remaining"
                    value={formatCurrency(getRemaining(recentGoal))}
                    hint="Amount left to hit target"
                    accent="cool"
                  />
                </div>
                <p className="selected-goal-focus-copy">{getGoalMotivation(recentGoal)}</p>
                <p className="selected-goal-focus-copy">{getEstimatedCompletion(recentGoal, weeklySavingsRate)}</p>
              </div>
            ) : (
              <div className="empty-state">Select or create a goal to see a focused progress summary.</div>
            )}
          </Card>
        </div>
      </section>
    </Layout>
  );
}
