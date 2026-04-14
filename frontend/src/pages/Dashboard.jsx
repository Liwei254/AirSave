import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import WalletCard from "../components/WalletCard.jsx";
import TransactionList from "../components/TransactionList.jsx";
import {
  getGoals,
  getTransactions,
  getWallet,
} from "../services/api";
import { formatCurrency } from "../utils/formatters";

export default function Dashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [transactions, setTransactions] = useState([]);
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
      const [walletData, goalsData, transactionsData] = await Promise.all([
        getWallet(),
        getGoals(),
        getTransactions(),
      ]);

      if (!isMounted) return;

      setWallet(walletData);
      setGoals(goalsData);
      setTransactions(transactionsData);
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
          <span className="metric-label">Total Savings</span>
          <p className="metric-value metric-value-sm">{formatCurrency(wallet?.balance)}</p>
          <div className="metric-meta">Current wallet value</div>
        </article>
      </section>

      <section className="app-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent activity</h2>
            <p className="card-subtitle">The latest five savings movements across your wallet.</p>
          </div>
          <div className="status-chip">{transactions.length} total</div>
        </div>
        <TransactionList
          transactions={transactions.slice(0, 5)}
          emptyMessage="No transactions yet. Visit Transactions to start saving."
        />
      </section>
    </Layout>
  );
}
