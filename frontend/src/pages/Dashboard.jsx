import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Just now";
  return dateFormatter.format(new Date(value));
}

function getGoalProgress(goal) {
  if (!goal?.targetAmount) return 0;
  return Math.min(100, Math.round((Number(goal.savedAmount || 0) / Number(goal.targetAmount)) * 100));
}

function getTransactionTone(type) {
  if (type === "CREDIT") return "badge badge-success";
  if (type === "DEBIT") return "badge badge-danger";
  return "badge badge-neutral";
}

function getNotificationTone(type) {
  if (type === "goal") return "badge badge-success";
  if (type === "saving") return "badge badge-warning";
  return "badge badge-neutral";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [amount, setAmount] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [goalLoading, setGoalLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      await fetchData({ initialLoad: true, isMounted });
    };

    loadDashboard();

    const interval = setInterval(() => {
      fetchData({ silent: true, isMounted });
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  async function fetchData({ silent = false, initialLoad = false, isMounted = true } = {}) {
    if (!silent) {
      setIsRefreshing(true);
    }

    try {
      const [walletRes, goalsRes, transactionsRes, notificationsRes] = await Promise.all([
        API.get("/wallet"),
        API.get("/goals"),
        API.get("/wallet/transactions"),
        API.get("/notifications"),
      ]);

      if (!isMounted) return;

      setWallet(walletRes.data);
      setGoals(goalsRes.data);
      setTransactions(transactionsRes.data.transactions || []);
      setNotifications(notificationsRes.data);
      setError("");
    } catch (err) {
      if (!isMounted) return;

      const status = err.response?.status;
      const message = err.response?.data?.message || "We could not load your account data.";

      if (status === 401 || status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      setError(message);
    } finally {
      if (isMounted) {
        setIsLoading(false);
        if (!silent || initialLoad) {
          setIsRefreshing(false);
        }
      }
    }
  }

  function showFeedback(type, message) {
    setFeedback({ type, message });
  }

  async function simulateTransaction() {
    if (!amount) return;

    setSaveLoading(true);
    setFeedback(null);

    try {
      await API.post("/transactions/simulate", {
        amount: Number(amount),
        rule: 10,
        goalId: selectedGoal || undefined,
      });

      showFeedback("success", "Round-up saved successfully.");
      setAmount("");
      setSelectedGoal("");
      await fetchData();
    } catch (err) {
      showFeedback("error", err.response?.data?.message || "Transaction failed.");
    } finally {
      setSaveLoading(false);
    }
  }

  async function createGoal() {
    if (!goalName || !targetAmount) return;

    setGoalLoading(true);
    setFeedback(null);

    try {
      await API.post("/goals", {
        name: goalName,
        targetAmount: Number(targetAmount),
      });

      showFeedback("success", "Goal created successfully.");
      setGoalName("");
      setTargetAmount("");
      await fetchData();
    } catch (err) {
      showFeedback("error", err.response?.data?.message || "Failed to create goal.");
    } finally {
      setGoalLoading(false);
    }
  }

  async function markNotificationAsRead(id) {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications((current) =>
        current.map((notification) =>
          notification._id === id ? { ...notification, read: true } : notification
        )
      );
    } catch (err) {
      showFeedback("error", err.response?.data?.message || "Failed to mark notification as read.");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  const rounded = amount ? Math.ceil(Number(amount) / 10) * 10 : 0;
  const savings = amount ? rounded - Number(amount) : 0;
  const activeGoals = goals.filter((goal) => goal.status !== "completed");
  const completedGoals = goals.filter((goal) => goal.status === "completed");
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const saveDisabled = !amount || Number(amount) <= 0 || saveLoading;
  const goalDisabled = !goalName.trim() || !targetAmount || Number(targetAmount) <= 0 || goalLoading;

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="app-card loading-panel">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading your dashboard...</span>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">AirSave Wallet</span>
          <h1 className="page-title">Save smarter with every transaction.</h1>
          <p className="page-subtitle">
            Track your balance, automate round-ups, and keep your goals moving with a cleaner
            savings workflow.
          </p>
        </div>

        <div className="header-actions">
          <div className="status-chip">
            {isRefreshing ? <span className="spinner spinner-dark" aria-hidden="true" /> : null}
            <span>{isRefreshing ? "Refreshing" : "Live data synced"}</span>
          </div>

          <button className="app-button app-button-secondary" type="button" onClick={() => fetchData()}>
            Refresh
          </button>

          <button className="app-button app-button-danger" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {feedback ? (
        <div className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
          <strong>{feedback.type === "success" ? "Success:" : "Error:"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="feedback feedback-error">
          <strong>Unable to load dashboard:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="metrics-grid">
        <article className="app-card metric-card">
          <span className="metric-label">Wallet Balance</span>
          <p className="metric-value">{formatCurrency(wallet?.balance)}</p>
          <div className="metric-meta">Available across all saved round-ups</div>
        </article>

        <article className="app-card metric-card">
          <span className="metric-label">Savings Goals</span>
          <p className="metric-value metric-value-sm">{activeGoals.length}</p>
          <div className="metric-meta">
            {completedGoals.length} completed goal{completedGoals.length === 1 ? "" : "s"}
          </div>
        </article>

        <article className="app-card metric-card">
          <span className="metric-label">Activity</span>
          <p className="metric-value metric-value-sm">{wallet?.transactionsCount || 0}</p>
          <div className="metric-meta">
            <span className="metric-highlight">{unreadNotifications} unread alerts</span>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Round-up savings</h2>
              <p className="card-subtitle">Save the difference automatically on each amount you enter.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="amount">
                Transaction amount
              </label>
              <input
                id="amount"
                className="app-input"
                type="number"
                min="1"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="goal">
                Goal destination
              </label>
              <select
                id="goal"
                className="app-select"
                value={selectedGoal}
                onChange={(e) => setSelectedGoal(e.target.value)}
              >
                <option value="">Keep in wallet</option>
                {goals.map((goal) => (
                  <option key={goal._id} value={goal._id}>
                    {goal.name} ({formatCurrency(goal.savedAmount)}/{formatCurrency(goal.targetAmount)})
                  </option>
                ))}
              </select>
            </div>

            <div className="preview-card">
              <strong>Round-up preview:</strong>{" "}
              {amount
                ? `You will save ${formatCurrency(savings)} from a ${formatCurrency(amount)} transaction.`
                : "Enter an amount to preview the savings amount."}
            </div>

            <div className="form-actions">
              <button
                className="app-button app-button-primary"
                type="button"
                onClick={simulateTransaction}
                disabled={saveDisabled}
              >
                {saveLoading ? <span className="spinner" aria-hidden="true" /> : null}
                <span>{saveLoading ? "Saving..." : "Save now"}</span>
              </button>
            </div>
          </div>
        </article>

        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Create a goal</h2>
              <p className="card-subtitle">Set a target and keep your savings focused.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="goalName">
                Goal name
              </label>
              <input
                id="goalName"
                className="app-input"
                type="text"
                placeholder="Emergency fund"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="targetAmount">
                Target amount
              </label>
              <input
                id="targetAmount"
                className="app-input"
                type="number"
                min="1"
                placeholder="50000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            </div>

            <p className="helper-text">Goals update automatically when round-up savings are assigned.</p>

            <div className="form-actions">
              <button
                className="app-button app-button-primary"
                type="button"
                onClick={createGoal}
                disabled={goalDisabled}
              >
                {goalLoading ? <span className="spinner" aria-hidden="true" /> : null}
                <span>{goalLoading ? "Creating..." : "Create goal"}</span>
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="section-grid">
        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Goals</h2>
              <p className="card-subtitle">Track progress across active and completed savings targets.</p>
            </div>
            <div className="status-chip">{goals.length} total</div>
          </div>

          {goals.length ? (
            <div className="goal-list">
              {goals.map((goal) => {
                const progress = getGoalProgress(goal);

                return (
                  <div className="goal-item" key={goal._id}>
                    <div className="goal-row">
                      <div>
                        <div className="goal-name">{goal.name}</div>
                        <div className="goal-meta">
                          <span>{formatCurrency(goal.savedAmount)} saved</span>
                          <span>Target {formatCurrency(goal.targetAmount)}</span>
                        </div>
                      </div>
                      <span className={goal.status === "completed" ? "badge badge-success" : "badge badge-neutral"}>
                        {goal.status || "active"}
                      </span>
                    </div>

                    <progress className="progress-track" value={progress} max="100">
                      {progress}%
                    </progress>

                    <div className="goal-row">
                      <span className="muted">{progress}% complete</span>
                      <span className="muted">
                        Remaining {formatCurrency(Math.max(0, Number(goal.targetAmount) - Number(goal.savedAmount)))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">No goals yet. Create one to start tracking your savings progress.</div>
          )}
        </article>

        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Notifications</h2>
              <p className="card-subtitle">Recent goal and savings updates from your account.</p>
            </div>
            <div className="status-chip">{unreadNotifications} unread</div>
          </div>

          {notifications.length ? (
            <div className="notification-list">
              {notifications.slice(0, 6).map((notification) => (
                <div className="notification-item" key={notification._id}>
                  <div className="notification-row">
                    <div>
                      <div className="notification-title">{notification.message}</div>
                      <div className="notification-meta">
                        <span>{formatDate(notification.createdAt)}</span>
                        <span className={getNotificationTone(notification.type)}>{notification.type || "update"}</span>
                      </div>
                    </div>

                    {!notification.read ? (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => markNotificationAsRead(notification._id)}
                      >
                        Mark as read
                      </button>
                    ) : (
                      <span className="badge badge-neutral">Read</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No notifications yet. Savings activity will appear here.</div>
          )}
        </article>
      </section>

      <section className="app-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Transaction history</h2>
            <p className="card-subtitle">A clean view of the most recent entries in your wallet ledger.</p>
          </div>
          <div className="status-chip">{transactions.length} entries</div>
        </div>

        {transactions.length ? (
          <div className="activity-list">
            {transactions.slice(0, 8).map((transaction) => (
              <div className="activity-item" key={transaction._id}>
                <div className="activity-row">
                  <div>
                    <div className="activity-title">
                      {transaction.description || transaction.reference || "Wallet activity"}
                    </div>
                    <div className="activity-meta">
                      <span>{formatDate(transaction.createdAt)}</span>
                      {transaction.reference ? <span>{transaction.reference}</span> : null}
                      {transaction.status ? <span>{transaction.status}</span> : null}
                    </div>
                  </div>

                  <div className="section-actions">
                    <span className={getTransactionTone(transaction.type)}>{transaction.type}</span>
                    <strong>{formatCurrency(transaction.amount)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No transactions yet. Your first round-up save will appear here.</div>
        )}
      </section>
    </main>
  );
}
