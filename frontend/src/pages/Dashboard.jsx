import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import WalletCard from "../components/WalletCard.jsx";
import TransactionList from "../components/TransactionList.jsx";
import { getGoals, getTransactions, getWallet } from "../services/api";
import { subscribeToDashboardRefresh } from "../utils/dashboardRefresh";
import { formatCurrency } from "../utils/formatters";

export default function Dashboard() {
  const navigate = useNavigate();

  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ FIX: useCallback to stabilize function
  const loadDashboard = useCallback(async () => {
    try {
      const [walletData, goalsData, transactionsData] = await Promise.all([
        getWallet(),
        getGoals(),
        getTransactions(),
      ]);

      setWallet(walletData);
      setGoals(goalsData);
      setTransactions(transactionsData);
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      setError(err.response?.data?.message || "We could not load your dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // ✅ FIX: proper dependency
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => subscribeToDashboardRefresh(loadDashboard), [loadDashboard]);

  const activeGoals = goals.filter((goal) => goal.status !== "completed");
  const completedGoals = goals.filter((goal) => goal.status === "completed");

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
     // eyebrow="Dashboard"
      title="Save smarter with every transaction."
      subtitle="Save smarter with roundups"
    >
      {error && (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      )}

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
          <p className="metric-value metric-value-sm">
            {wallet?.transactionsCount || 0}
          </p>
          <div className="metric-meta">Latest wallet activity</div>
        </article>

        <article className="app-card metric-card">
          <span className="metric-label">Total Savings</span>
          <p className="metric-value metric-value-sm">
            {formatCurrency(wallet?.balance)}
          </p>
          <div className="metric-meta">Current wallet value</div>
        </article>
      </section>

      <section className="app-card">
        <div className="card-header d-flex justify-content-between align-items-center">
         <span className="status-chip fs-5 fw-semibold">Recent Activities</span>
          <div className="status-chip">{transactions.length} total</div>
        </div>

        <TransactionList
          transactions={transactions.slice(0, 5)}
          emptyMessage="No transactions yet. Visit Savings to start saving."
        />
      </section>
    </Layout>
  );
}
