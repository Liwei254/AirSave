import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import WalletCard from "../components/WalletCard.jsx";
import GoalCard from "../components/GoalCard.jsx";
import TransactionList from "../components/TransactionList.jsx";
import NotificationList from "../components/NotificationList.jsx";
import {
  getGoals,
  getNotifications,
  getTransactions,
  getWallet,
  markNotificationRead,
} from "../services/api";
import { formatCurrency } from "../utils/formatters";

export default function Dashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    loadDashboard(isMounted, true);

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadDashboard(isMounted = true, initialLoad = false) {
    if (!initialLoad) {
      setIsRefreshing(true);
    }

    try {
      const [walletData, goalsData, transactionsData, notificationsData] = await Promise.all([
        getWallet(),
        getGoals(),
        getTransactions(),
        getNotifications(),
      ]);

      if (!isMounted) return;

      setWallet(walletData);
      setGoals(goalsData);
      setTransactions(transactionsData);
      setNotifications(notificationsData);
      setError("");
    } catch (err) {
      if (!isMounted) return;

      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      setError(err.response?.data?.message || "We could not load your dashboard.");
    } finally {
      if (isMounted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }

  async function handleMarkAsRead(id) {
    try {
      await markNotificationRead(id);
      setNotifications((current) =>
        current.map((notification) =>
          notification._id === id ? { ...notification, read: true } : notification
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update notification.");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  const activeGoals = goals.filter((goal) => goal.status !== "completed");
  const completedGoals = goals.filter((goal) => goal.status === "completed");
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  if (isLoading) {
    return (
      <Layout shellClassName="page-shell">
        <section className="app-card loading-panel">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading your dashboard...</span>
        </section>
      </Layout>
    );
  }

  return (
    <Layout
      eyebrow="Dashboard"
      title="Save smarter with every transaction."
      subtitle="Your overview of savings balance, active goals, recent activity, and alerts."
      actions={
        <>
          <div className="status-chip">
            {isRefreshing ? <span className="spinner spinner-dark" aria-hidden="true" /> : null}
            <span>{isRefreshing ? "Refreshing" : "Live data synced"}</span>
          </div>
          <button className="app-button app-button-secondary" type="button" onClick={() => loadDashboard(true)}>
            Refresh
          </button>
          <button className="app-button app-button-danger" type="button" onClick={logout}>
            Logout
          </button>
        </>
      }
    >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="wallet-row">
        <WalletCard
          balance={formatCurrency(wallet?.balance)}
          subtitle="Available across all saved round-ups"
        />
      </section>

      <section className="summary-grid">
        <article className="app-card metric-card">
          <span className="metric-label">Active Goals</span>
          <p className="metric-value metric-value-sm">{activeGoals.length}</p>
          <div className="metric-meta">{completedGoals.length} completed goals</div>
        </article>
        <article className="app-card metric-card">
          <span className="metric-label">Transactions</span>
          <p className="metric-value metric-value-sm">{wallet?.transactionsCount || 0}</p>
          <div className="metric-meta">Latest wallet activity</div>
        </article>
        <article className="app-card metric-card">
          <span className="metric-label">Notifications</span>
          <p className="metric-value metric-value-sm">{unreadNotifications}</p>
          <div className="metric-meta">Unread account alerts</div>
        </article>
      </section>

      <section className="dashboard-columns">
        <article className="app-card goals-column">
          <div className="card-header">
            <div>
              <h2 className="card-title">Goal progress</h2>
              <p className="card-subtitle">A quick view of your active and completed savings goals.</p>
            </div>
          </div>

          {goals.length ? (
            <div className="goal-list">
              {goals.slice(0, 4).map((goal) => (
                <GoalCard key={goal._id} goal={goal} />
              ))}
            </div>
          ) : (
            <div className="empty-state">No goals yet. Visit Goals to create your first target.</div>
          )}
        </article>

        <article className="app-card activity-column">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent activity</h2>
              <p className="card-subtitle">Your latest wallet transactions, updated live.</p>
            </div>
          </div>
          <TransactionList
            transactions={transactions.slice(0, 5)}
            emptyMessage="No transactions yet. Visit Transactions to start saving."
          />
        </article>
      </section>

      <section className="section-grid">
        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Notifications</h2>
              <p className="card-subtitle">Recent goal and savings updates from your account.</p>
            </div>
            <div className="status-chip">{unreadNotifications} unread</div>
          </div>
          <NotificationList
            notifications={notifications.slice(0, 6)}
            onMarkAsRead={handleMarkAsRead}
            emptyMessage="No notifications yet. Savings activity will appear here."
          />
        </article>

        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Performance snapshot</h2>
              <p className="card-subtitle">A clean summary of where your account stands right now.</p>
            </div>
          </div>

          <div className="admin-panel-grid">
            <div className="admin-panel-tile">
              <span className="metric-label">Wallet balance</span>
              <strong>{formatCurrency(wallet?.balance)}</strong>
              <span className="muted">Current total savings available.</span>
            </div>
            <div className="admin-panel-tile">
              <span className="metric-label">Goal completion</span>
              <strong>{completedGoals.length}</strong>
              <span className="muted">Targets already completed by your account.</span>
            </div>
          </div>
        </article>
      </section>
    </Layout>
  );
}
