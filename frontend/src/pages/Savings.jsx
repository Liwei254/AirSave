import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import GoalCard from "../components/GoalCard.jsx";
import WalletCard from "../components/WalletCard.jsx";
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

const phonePattern = /^(0\d{9}|\+254\d{9}|254\d{9})$/;

function sortActivityByNewest(activityItems) {
  return [...(activityItems || [])].sort(
    (left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0)
  );
}

export default function Savings() {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [goalForm, setGoalForm] = useState({ name: "", targetAmount: "", duration: "" });
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [rule, setRule] = useState(10);
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

  const trimmedPhone = phone.trim();
  const isPhoneValid = phonePattern.test(trimmedPhone);
  const phoneError =
    trimmedPhone && !isPhoneValid
      ? "Enter a valid phone number in the format 07XXXXXXXX or +254XXXXXXXXX."
      : "";

  const loadDashboard = useCallback(async () => {
    const [walletData, goalsData, activityData] = await Promise.all([
      getWallet(),
      getGoals(),
      getSavingsActivity(),
    ]);

    if (!isMountedRef.current) {
      return;
    }

    setWallet(walletData);
    setGoals(goalsData);
    setActivity(sortActivityByNewest(activityData));
  }, []);

  async function handleCreateGoal(event) {
    event.preventDefault();

    if (!goalForm.name.trim() || !goalForm.targetAmount || !goalForm.duration.trim()) {
      setFeedback({ type: "error", message: "Complete all goal fields before creating a goal." });
      return;
    }

    if (Number(goalForm.targetAmount) <= 0) {
      setFeedback({ type: "error", message: "Target amount must be greater than zero." });
      return;
    }

    setIsGoalSubmitting(true);
    setFeedback(null);

    try {
      await createGoal({
        name: goalForm.name.trim(),
        targetAmount: Number(goalForm.targetAmount),
        duration: goalForm.duration.trim(),
      });

      await loadDashboard();
      triggerDashboardRefresh();
      setGoalForm({ name: "", targetAmount: "", duration: "" });
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

    if (isSaveSubmitting || isRefreshingAfterPayment) {
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setFeedback({ type: "error", message: "Enter an amount greater than zero." });
      return;
    }

    if (!trimmedPhone) {
      setFeedback({ type: "error", message: "Phone number is required." });
      return;
    }

    if (!isPhoneValid) {
      setFeedback({ type: "error", message: phoneError });
      return;
    }

    if (!selectedGoal) {
      setFeedback({ type: "error", message: "Select a goal before submitting payment." });
      return;
    }

    setIsSaveSubmitting(true);
    setFeedback(null);

    try {
      const res = await initiatePayment({
        amount: Number(amount),
        rule,
        phone: trimmedPhone,
        goalId: selectedGoal,
      });

      await loadDashboard();
      triggerDashboardRefresh();
      setPaymentRef(res.paymentReference);
      setIsRefreshingAfterPayment(true);
      setAmount("");
      setFeedback({
        type: "success",
        message: "STK push sent. Processing...",
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

  const numericAmount = Number(amount);
  const rounded = amount ? Math.ceil(numericAmount / rule) * rule : 0;
  const savings = amount ? rounded - numericAmount : 0;
  const goalDisabled =
    !goalForm.name.trim() ||
    !goalForm.targetAmount ||
    Number(goalForm.targetAmount) <= 0 ||
    !goalForm.duration.trim() ||
    isGoalSubmitting;
  const saveDisabled =
    !amount ||
    Number(amount) <= 0 ||
    !selectedGoal ||
    !trimmedPhone ||
    !isPhoneValid ||
    isSaveSubmitting ||
    isRefreshingAfterPayment;

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
                      ? "STK push sent. Updated."
                      : "STK push sent, but the payment did not complete.",
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
      title="Goal, save, and review activity from one page."
      subtitle="Create a target, save into it with M-Pesa round-ups, and keep the full savings workflow together."
    >
      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
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
        <section className="wallet-row">
          <WalletCard
            balance={formatCurrency(wallet.balance)}
            subtitle={`${wallet.transactionsCount || 0} wallet entries across your savings flow`}
          />
        </section>
      ) : null}

      <section className="row g-4 mb-4">
        <div className="col-12 col-xl-5">
          <article className="app-card h-100">
            <div className="card-header">
              <div>
                <h2 className="card-title">Create Goal</h2>
                <p className="card-subtitle">Add the target amount and duration before you start saving.</p>
              </div>
            </div>

            <form className="d-grid gap-3" onSubmit={handleCreateGoal}>
              <div>
                <label className="form-label fw-semibold" htmlFor="goalName">
                  Goal name
                </label>
                <input
                  id="goalName"
                  className="form-control"
                  type="text"
                  placeholder="Emergency fund"
                  value={goalForm.name}
                  onChange={(event) =>
                    setGoalForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>

              <div>
                <label className="form-label fw-semibold" htmlFor="goalTargetAmount">
                  Target amount
                </label>
                <input
                  id="goalTargetAmount"
                  className="form-control"
                  type="number"
                  min="1"
                  placeholder="50000"
                  value={goalForm.targetAmount}
                  onChange={(event) =>
                    setGoalForm((current) => ({ ...current, targetAmount: event.target.value }))
                  }
                />
              </div>

              <div>
                <label className="form-label fw-semibold" htmlFor="goalDuration">
                  Duration
                </label>
                <input
                  id="goalDuration"
                  className="form-control"
                  type="text"
                  placeholder="6 months or Dec 2026"
                  value={goalForm.duration}
                  onChange={(event) =>
                    setGoalForm((current) => ({ ...current, duration: event.target.value }))
                  }
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={goalDisabled}>
                {isGoalSubmitting ? "Creating..." : "Create goal"}
              </button>
            </form>
          </article>
        </div>

        <div className="col-12 col-xl-7">
          <article className="app-card h-100">
            <div className="card-header">
              <div>
                <h2 className="card-title">Save To Goal</h2>
                <p className="card-subtitle">Pick a destination and trigger the payment-backed savings action.</p>
              </div>
            </div>

            <form className="d-grid gap-3" onSubmit={handleSave}>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="saveAmount">
                    Amount
                  </label>
                  <input
                    id="saveAmount"
                    className="form-control"
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="savePhone">
                    Phone number
                  </label>
                  <input
                    id="savePhone"
                    className={`form-control ${phoneError ? "is-invalid" : ""}`}
                    type="tel"
                    placeholder="07XXXXXXXX or +254XXXXXXXXX"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                  />
                  {phoneError ? <div className="invalid-feedback">{phoneError}</div> : null}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="saveGoal">
                    Select goal
                  </label>
                  <select
                    id="saveGoal"
                    className="form-select"
                    value={selectedGoal}
                    onChange={(event) => setSelectedGoal(event.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a goal
                    </option>
                    {activeGoals.map((goal) => (
                      <option key={goal._id} value={goal._id}>
                        {goal.name} ({formatCurrency(goal.savedAmount)}/{formatCurrency(goal.targetAmount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="roundingRule">
                    Rounding logic
                  </label>
                  <select
                    id="roundingRule"
                    className="form-select"
                    value={rule}
                    onChange={(event) => setRule(Number(event.target.value))}
                  >
                    {roundingOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="alert alert-info mb-0">
                <div className="fw-semibold mb-1">M-Pesa preview</div>
                <div>Charge amount: {formatCurrency(rounded)}</div>
                <div>Savings amount: {formatCurrency(savings)}</div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={saveDisabled}>
                {isSaveSubmitting || isRefreshingAfterPayment ? "Processing..." : "Save with M-Pesa"}
              </button>
            </form>
          </article>
        </div>
      </section>

      <section className="row g-4">
        <div className="col-12 col-xl-5">
          <article className="app-card h-100">
            <div className="card-header">
              <div>
                <h2 className="card-title">Goals</h2>
                <p className="card-subtitle">All active and completed goals stay visible here.</p>
              </div>
              {!isLoading ? <span className="status-chip">{goals.length} total</span> : null}
            </div>

            {isLoading ? (
              <div className="loading-panel">
                <span className="spinner spinner-dark" aria-hidden="true" />
                <span>Loading goals...</span>
              </div>
            ) : goals.length ? (
              <div className="goal-list">
                {goals.map((goal) => (
                  <GoalCard key={goal._id} goal={goal} />
                ))}
              </div>
            ) : (
              <div className="empty-state">No goals yet. Create one to start your savings flow.</div>
            )}
          </article>
        </div>

        <div className="col-12 col-xl-7">
          <article className="app-card h-100">
            <div className="card-header">
              <div>
                <h2 className="card-title">Activity</h2>
                <p className="card-subtitle">Every savings attempt with amount, savings, date, and status.</p>
              </div>
              {!isLoading ? <span className="status-chip">{activity.length} records</span> : null}
            </div>

            {isLoading ? (
              <div className="loading-panel">
                <span className="spinner spinner-dark" aria-hidden="true" />
                <span>Loading activity...</span>
              </div>
            ) : activity.length ? (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Savings</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <div className="fw-semibold">{formatCurrency(item.amount)}</div>
                          <div className="small text-body-secondary">{item.goalName}</div>
                        </td>
                        <td>{formatCurrency(item.savings)}</td>
                        <td>{formatDate(item.date)}</td>
                        <td>
                          <span
                            className={`badge ${
                              item.status === "confirmed"
                                ? "text-bg-success"
                                : item.status === "failed"
                                  ? "text-bg-danger"
                                  : "text-bg-warning"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No savings activity yet. Your first payment will appear here.</div>
            )}
          </article>
        </div>
      </section>
    </Layout>
  );
}
