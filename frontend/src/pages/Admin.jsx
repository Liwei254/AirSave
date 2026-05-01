import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { getGoals, getNotifications, getTransactions, getWallet } from "../services/api";
import { formatCurrency } from "../utils/formatters";

export default function Admin() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAdminPage = useCallback(async (isMounted = true) => {
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
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || "We could not load the admin overview.");
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;
    loadAdminPage(isMounted);
    return () => {
      isMounted = false;
    };
  }, [loadAdminPage]);

  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  return (
    <Layout
      eyebrow="Admin"
      title="Operational overview."
      subtitle="A clean control surface for account-level insights and current system-facing metrics."
    >
      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="app-card loading-panel">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading admin overview...</span>
        </section>
      ) : (
        <>
          <section className="summary-grid">
            <article className="app-card metric-card">
              <span className="metric-label">Wallet balance</span>
              <p className="metric-value metric-value-sm">{formatCurrency(wallet?.balance)}</p>
              <div className="metric-meta">Current available savings balance.</div>
            </article>
            <article className="app-card metric-card">
              <span className="metric-label">Goal records</span>
              <p className="metric-value metric-value-sm">{goals.length}</p>
              <div className="metric-meta">Historical goal records in the account.</div>
            </article>
            <article className="app-card metric-card">
              <span className="metric-label">Notifications</span>
              <p className="metric-value metric-value-sm">{unreadNotifications}</p>
              <div className="metric-meta">Unread alerts pending review.</div>
            </article>
          </section>

          <section className="section-grid">
            <article className="app-card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">System metrics</h2>
                  <p className="card-subtitle">Operational indicators pulled from your current account state.</p>
                </div>
              </div>

              <div className="admin-panel-grid">
                <div className="admin-panel-tile">
                  <span className="metric-label">Transactions</span>
                  <strong>{transactions.length}</strong>
                  <span className="muted">Ledger entries available for this account.</span>
                </div>
                <div className="admin-panel-tile">
                  <span className="metric-label">Sync cadence</span>
                  <strong>Manual refresh</strong>
                  <span className="muted">Use the page navigation to review live data by function.</span>
                </div>
              </div>
            </article>

            <article className="app-card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Operations notes</h2>
                  <p className="card-subtitle">High-level guidance for how the current frontend is structured.</p>
                </div>
              </div>

              <div className="support-stack">
                <div className="support-item">
                  <strong>Goal and transactions are page-specific</strong>
                  <span className="muted">Each primary workflow now has its own page and data composition boundary.</span>
                </div>
                <div className="support-item">
                  <strong>Reusable UI components are shared</strong>
                  <span className="muted">Wallet, goal, transactions, notifications, and page layout are componentized.</span>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </Layout>
  );
}
