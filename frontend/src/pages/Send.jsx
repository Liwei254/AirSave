import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import {
  getCurrentUser,
  getPaymentStatus,
  initiatePayment,
} from "../services/api";

const paymentPollDelayMs = 1000;
const paymentPollAttempts = 7;
const terminalPaymentStatuses = ["confirmed", "completed", "success", "successful", "failed"];
const phonePattern = /^(0[17]\d{8}|\+?254[17]\d{8})$/;

function wait(delay) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseAmountInput(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  return digitsOnly ? String(Number(digitsOnly)) : "";
}

function normalizeDisplayPhone(value) {
  if (!value) return "";
  if (value.startsWith("+254")) return `0${value.slice(4)}`;
  if (value.startsWith("254")) return `0${value.slice(3)}`;
  return value;
}

export default function Send() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [recipientMode, setRecipientMode] = useState("self");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const userData = await getCurrentUser();
        if (!isMounted) return;
        setUser(userData);
        setRecipientPhone(normalizeDisplayPhone(userData?.phone || ""));
      } catch (error) {
        if (!isMounted) return;
        if (error.response?.status === 401 || error.response?.status === 403) {
          navigate("/");
        } else {
          setFeedback({ type: "error", message: error.message || "We could not load your account." });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadUser();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (recipientMode === "self") {
      setRecipientPhone(normalizeDisplayPhone(user?.phone || ""));
    } else {
      setRecipientPhone("");
    }
  }, [recipientMode, user?.phone]);

  const numericAmount = Number(amount || 0);
  const validPhone = recipientMode === "self" || phonePattern.test(recipientPhone.trim());
  const canConfirm = numericAmount > 0 && validPhone && !isSubmitting;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!numericAmount || !validPhone) {
      setFeedback({ type: "error", message: "Enter a valid amount and recipient before confirming." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payment = await initiatePayment({
        amount: numericAmount,
        merchant: recipientMode === "self" ? "Send to myself" : `Send to ${recipientPhone.trim()}`,
        description: recipientMode === "self" ? "Send to myself" : `Send to another number ${recipientPhone.trim()}`,
        transactionType: "send",
        mode: "send-mobile",
      });

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

      setAmount("");
      setSubmitted(false);
      setFeedback({
        type: "success",
        message:
          String(payment.status || "").toLowerCase() === "confirmed"
            ? "Transfer confirmed successfully."
            : "Transfer request sent. Confirmation is in progress.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete this transfer.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout shellClassName="save-reference-shell">
      <div className="purchase-flow-page">
        {feedback ? (
          <div className={`premium-toast premium-toast-${feedback.type}`}>
            <strong>{feedback.type === "success" ? "Done" : "Action needed"}</strong>
            <span>{feedback.message}</span>
          </div>
        ) : null}

        <div className="service-breadcrumb">
          <button type="button" onClick={() => navigate("/dashboard")}>Dashboard</button>
          <span>/</span>
          <span>Send to Mobile</span>
        </div>

        {isLoading ? (
          <section className="premium-panel loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading send flow...</span>
          </section>
        ) : (
          <form className="purchase-grid" onSubmit={handleSubmit}>
            <section className="purchase-form premium-panel">
              <div className="premium-section-head">
                <div>
                  <span className="premium-kicker">WALLET SERVICE</span>
                  <h1>Send to Mobile</h1>
                  <p>Choose a recipient, enter an amount, and confirm the transfer.</p>
                </div>
              </div>

              <div className="service-choice-group" aria-label="Recipient options">
                <button
                  type="button"
                  className={recipientMode === "self" ? "service-choice-card service-choice-card-active" : "service-choice-card"}
                  onClick={() => setRecipientMode("self")}
                >
                  <strong>Send to myself</strong>
                  <span>{normalizeDisplayPhone(user?.phone || "") || "Your number"}</span>
                </button>
                <button
                  type="button"
                  className={recipientMode === "other" ? "service-choice-card service-choice-card-active" : "service-choice-card"}
                  onClick={() => setRecipientMode("other")}
                >
                  <strong>Send to another number</strong>
                  <span>Enter recipient phone number</span>
                </button>
              </div>

              <div className="premium-form purchase-fields">
                <label>
                  <span>Recipient phone number</span>
                  <input
                    value={recipientPhone}
                    onChange={(event) => setRecipientPhone(event.target.value)}
                    placeholder="07XXXXXXXX"
                    disabled={recipientMode === "self"}
                  />
                </label>

                <label>
                  <span>Amount</span>
                  <div className={submitted && !numericAmount ? "purchase-amount-input purchase-input-error" : "purchase-amount-input"}>
                    <small>KES</small>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="100"
                      value={amount ? new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(numericAmount) : ""}
                      onChange={(event) => setAmount(parseAmountInput(event.target.value))}
                    />
                  </div>
                </label>
              </div>
            </section>

            <aside className="purchase-preview premium-panel">
              <span className="premium-kicker">Transaction preview</span>
              <div className="purchase-preview-total">
                <span>Transfer amount</span>
                <strong>{formatCurrency(numericAmount)}</strong>
              </div>
              <div className="purchase-preview-list">
                <div><span>Recipient</span><strong>{recipientPhone || "Not set"}</strong></div>
                <div><span>Source</span><strong>{normalizeDisplayPhone(user?.phone || "") || "AirSave wallet"}</strong></div>
                <div><span>Amount</span><strong>{formatCurrency(numericAmount)}</strong></div>
              </div>
              <button className="purchase-confirm-button" type="submit" disabled={!canConfirm}>
                {isSubmitting ? <span className="spinner purchase-spinner" aria-hidden="true" /> : null}
                {isSubmitting ? "Confirming..." : "Confirm Transfer"}
              </button>
              <button className="service-secondary-link" type="button" onClick={() => navigate("/dashboard")}>
                Cancel
              </button>
            </aside>
          </form>
        )}
      </div>
    </Layout>
  );
}
