import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { getGoals, getWallet, submitWithdrawal } from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { formatCurrency } from "../utils/formatters";

export default function Withdraw() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("wallet");
  const [breakGoal, setBreakGoal] = useState(false);
  const [needsBreakConfirmation, setNeedsBreakConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");

  const loadWithdrawPage = useCallback(async (isMounted = true) => {
    try {
      const [walletData, goalsData] = await Promise.all([getWallet(), getGoals()]);

      if (!isMounted) return;

      setWallet(walletData);
      setGoals(goalsData);
      setError("");
    } catch (err) {
      if (!isMounted) return;
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || "We could not load your withdrawal options.");
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;
    loadWithdrawPage(isMounted);
    return () => {
      isMounted = false;
    };
  }, [loadWithdrawPage]);

  const sourceOptions = useMemo(
    () => [
      { value: "wallet", label: `Savings wallet (${formatCurrency(wallet?.balance)})`, type: "wallet" },
      ...goals.map((goal) => ({
        value: `goal:${goal._id}`,
        label: `${goal.name} (${formatCurrency(goal.savedAmount)})`,
        type: "goal",
        goal,
      })),
    ],
    [goals, wallet?.balance]
  );

  const selectedSource = sourceOptions.find((option) => option.value === source) || sourceOptions[0];
  const selectedGoal = selectedSource?.goal || null;
  const showMaturityWarning = Boolean(selectedGoal && selectedGoal.status !== "completed");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!amount || Number(amount) <= 0 || !selectedSource) {
      return;
    }

    if (showMaturityWarning && !breakGoal) {
      setNeedsBreakConfirmation(true);
      setFeedback(null);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await submitWithdrawal(
        selectedSource.type === "goal"
          ? {
              amount: Number(amount),
              sourceType: "goal",
              sourceId: selectedGoal._id,
              breakGoal,
            }
          : {
              amount: Number(amount),
              sourceType: "wallet",
            }
      );

      setAmount("");
      setBreakGoal(false);
      setNeedsBreakConfirmation(false);
      setFeedback({
        type: "success",
        message: response.message || "Withdrawal submitted successfully.",
      });
      await loadWithdrawPage(true);
      triggerDashboardRefresh();
    } catch (err) {
      const message = err.response?.data?.message || "Withdrawal request failed.";
      setFeedback({ type: "error", message });
      setNeedsBreakConfirmation(err.response?.data?.code === "GOAL_NOT_MATURED");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout
      // eyebrow="Withdraw"
      title="Withdraw from your wallet or a selected goal."
      subtitle="Choose the source, handle maturity warnings clearly, and submit the request in one flow."
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

      <section className="row justify-content-center">
        <div className="col-12 col-lg-8">
          <article className="app-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Withdrawal request</h2>
                <p className="card-subtitle">Pick a source and submit the amount you want to move out.</p>
              </div>
              {!isLoading ? <span className="status-chip">Wallet {formatCurrency(wallet?.balance)}</span> : null}
            </div>

            {isLoading ? (
              <div className="loading-panel">
                <span className="spinner spinner-dark" aria-hidden="true" />
                <span>Loading withdrawal details...</span>
              </div>
            ) : (
              <form className="d-grid gap-3" onSubmit={handleSubmit}>
                <div>
                  <label className="form-label fw-semibold" htmlFor="withdrawAmount">
                    Amount
                  </label>
                  <input
                    id="withdrawAmount"
                    className="form-control"
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label fw-semibold" htmlFor="withdrawSource">
                    Source selection
                  </label>
                  <select
                    id="withdrawSource"
                    className="form-select"
                    value={selectedSource?.value || "wallet"}
                    onChange={(event) => {
                      setSource(event.target.value);
                      setBreakGoal(false);
                      setNeedsBreakConfirmation(false);
                    }}
                  >
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {showMaturityWarning ? (
                  <div className="alert alert-warning mb-0">
                    <div className="fw-semibold">This goal has not matured</div>
                    <div className="small mt-1">
                      {selectedGoal.name} is still in progress. Break the goal to continue, or cancel and keep saving.
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-3">
                      <button
                        className={`btn ${breakGoal ? "btn-warning" : "btn-outline-warning"}`}
                        type="button"
                        onClick={() => {
                          setBreakGoal(true);
                          setNeedsBreakConfirmation(false);
                        }}
                      >
                        Break goal
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => {
                          setSource("wallet");
                          setBreakGoal(false);
                          setNeedsBreakConfirmation(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {needsBreakConfirmation && !breakGoal ? (
                  <div className="alert alert-warning mb-0">
                    Select <strong>Break goal</strong> to continue with this withdrawal.
                  </div>
                ) : null}

                <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit withdrawal request"}
                </button>
              </form>
            )}
          </article>
        </div>
      </section>
    </Layout>
  );
}
