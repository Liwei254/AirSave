import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import SaveFlow from "../components/SaveFlow.jsx";
import { getCurrentUser, getPaymentStatus, getSavingsActivity, getWallet, initiatePayment } from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { sortActivityByNewest } from "../utils/savings";

const paymentPollDelayMs = 1000;
const paymentPollAttempts = 7;
const terminalPaymentStatuses = ["confirmed", "completed", "success", "successful", "failed"];

function wait(delay) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

export default function LipaNaAirSave() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    try {
      const [activityData, walletData, userData] = await Promise.all([
        getSavingsActivity(),
        getWallet(),
        getCurrentUser(),
      ]);

      setActivity(sortActivityByNewest(activityData || []));
      setWallet(walletData);
      setUser(userData);
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || err.message || "We could not load this payment flow.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function handleSubmit(payload) {
    setIsSubmitting(true);
    try {
      const payment = await initiatePayment(payload);
      const paymentReference = payment.paymentReference || payment.reference;

      if (paymentReference) {
        for (let attempt = 0; attempt < paymentPollAttempts; attempt += 1) {
          await wait(paymentPollDelayMs);
          const statusResult = await getPaymentStatus(paymentReference);
          const normalizedStatus = String(statusResult.status || "").toLowerCase();

          if (terminalPaymentStatuses.includes(normalizedStatus)) {
            payment.status = statusResult.status;
            break;
          }
        }
      }

      await loadPage();
      triggerDashboardRefresh();
      return payment;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout shellClassName="save-reference-shell">
      {error ? (
        <div className="feedback feedback-error save-reference-page-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="ui-card loading-panel save-reference-loading">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading payment flow...</span>
        </section>
      ) : (
        <SaveFlow
          activity={activity}
          wallet={wallet}
          user={user}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </Layout>
  );
}
