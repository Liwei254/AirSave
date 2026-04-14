import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import TransactionList from "../components/TransactionList.jsx";
import WalletCard from "../components/WalletCard.jsx";
import { getGoals, getTransactions, getWallet, simulateTransaction } from "../services/api";
import { formatCurrency } from "../utils/formatters";

export default function Transactions() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [amount, setAmount] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    loadTransactionsPage(isMounted);
    return () => {
      isMounted = false;
    };
  }, []);

  async function loadTransactionsPage(isMounted = true) {
    try {
      const [walletData, transactionsData, goalsData] = await Promise.all([
        getWallet(),
        getTransactions(),
        getGoals(),
      ]);

      if (!isMounted) return;

      setWallet(walletData);
      setTransactions(transactionsData);
      setGoals(goalsData);
      setError("");
    } catch (err) {
      if (!isMounted) return;
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || "We could not load your transactions.");
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }

  async function handleSimulateTransaction() {
    if (!amount) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await simulateTransaction({
        amount: Number(amount),
        rule: 10,
        goalId: selectedGoal || undefined,
      });

      setAmount("");
      setSelectedGoal("");
      setFeedback({ type: "success", message: "Round-up saved successfully." });
      await loadTransactionsPage(true);
    } catch (err) {
      setFeedback({ type: "error", message: err.response?.data?.message || "Transaction failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const rounded = amount ? Math.ceil(Number(amount) / 10) * 10 : 0;
  const savings = amount ? rounded - Number(amount) : 0;
  const saveDisabled = !amount || Number(amount) <= 0 || isSubmitting;
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesType = typeFilter === "ALL" || transaction.type === typeFilter;
    const matchesDate =
      dateFilter === "ALL" ||
      (() => {
        const txDate = new Date(transaction.createdAt);
        const now = new Date();
        if (dateFilter === "7D") {
          return now - txDate <= 7 * 24 * 60 * 60 * 1000;
        }
        if (dateFilter === "30D") {
          return now - txDate <= 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      })();

    return matchesType && matchesDate;
  });

  return (
    <Layout
      eyebrow="Transactions"
      title="Monitor every savings movement."
      subtitle="Review transaction history, simulate new round-ups, and understand current wallet activity."
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
            subtitle={`${wallet.transactionsCount || 0} total wallet entries`}
          />
        </section>
      ) : null}

      <section className="transaction-page-grid">
        <article className="app-card compact-action-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Quick round-up</h2>
              <p className="card-subtitle">Use this only when you want to create a new round-up.</p>
            </div>
          </div>

          <div className="quick-save-card">
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
                  onClick={handleSimulateTransaction}
                  disabled={saveDisabled}
                >
                  {isSubmitting ? <span className="spinner" aria-hidden="true" /> : null}
                  <span>{isSubmitting ? "Saving..." : "Save now"}</span>
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Filters</h2>
              <p className="card-subtitle">Narrow the list to the transactions you need right now.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="loading-panel">
              <span className="spinner spinner-dark" aria-hidden="true" />
              <span>Loading filters...</span>
            </div>
          ) : (
            <div className="filter-stack">
              <div className="field-group">
                <label className="field-label" htmlFor="typeFilter">
                  Type
                </label>
                <select
                  id="typeFilter"
                  className="app-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="ALL">All transactions</option>
                  <option value="CREDIT">Credits</option>
                  <option value="DEBIT">Debits</option>
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="dateFilter">
                  Date range
                </label>
                <select
                  id="dateFilter"
                  className="app-select"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="ALL">All time</option>
                  <option value="7D">Last 7 days</option>
                  <option value="30D">Last 30 days</option>
                </select>
              </div>

              <div className="status-chip">{filteredTransactions.length} matches</div>
            </div>
          )}
        </article>
      </section>

      <section className="app-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Full transaction history</h2>
            <p className="card-subtitle">A clean list of all wallet ledger activity.</p>
          </div>
          {!isLoading ? <div className="status-chip">{filteredTransactions.length} entries</div> : null}
        </div>

        {isLoading ? (
          <div className="loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading transactions...</span>
          </div>
        ) : (
          <TransactionList
            transactions={filteredTransactions}
            emptyMessage="No transactions yet. Your first round-up save will appear here."
          />
        )}
      </section>
    </Layout>
  );
}
